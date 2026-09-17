import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dec, startOfDay, validate } from '../common/utils';
import { RequirePerms } from '../auth/decorators';

const COUNTED = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'];

const rangeSchema = z.object({
  range: z.enum(['today', '7d', '30d', '90d', '180d', '1y', 'custom']).default('30d'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function rangeToDates(dto: z.infer<typeof rangeSchema>): { from: Date; to: Date } {
  const to = dto.to ?? new Date();
  if (dto.range === 'custom' && dto.from) return { from: dto.from, to };
  const days = { today: 0, '7d': 7, '30d': 30, '90d': 90, '180d': 180, '1y': 365, custom: 30 }[dto.range];
  const from = startOfDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  return { from, to };
}

@Controller('admin/reports')
export class ReportsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Dashboard KPIs ----------------

  @RequirePerms('dashboard.view')
  @Get('dashboard')
  async dashboard() {
    const now = new Date();
    const today = startOfDay(now);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const counted = { status: { in: COUNTED } };

    const [
      totalSales, todaySales, weekSales, monthSales,
      totalOrders, pendingOrders, shippedOrders, deliveredOrders, cancelledOrders,
      pendingReturns, pendingRefunds,
      totalCustomers, newCustomers,
      activeProducts, variants,
      activeOffers, activeCoupons, monthRedemptions,
      abandonedCarts,
    ] = await Promise.all([
      this.prisma.order.aggregate({ where: counted, _sum: { total: true } }),
      this.prisma.order.aggregate({ where: { ...counted, placedAt: { gte: today } }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.order.aggregate({ where: { ...counted, placedAt: { gte: weekAgo } }, _sum: { total: true } }),
      this.prisma.order.aggregate({ where: { ...counted, placedAt: { gte: monthAgo } }, _sum: { total: true } }),
      this.prisma.order.count({ where: counted }),
      this.prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING', 'PACKED'] } } }),
      this.prisma.order.count({ where: { status: { in: ['SHIPPED', 'OUT_FOR_DELIVERY'] } } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { status: 'CANCELLED' } }),
      this.prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUND_PROCESSING'] } } }),
      this.prisma.refund.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { some: { role: { name: 'CUSTOMER' } } } } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: monthAgo }, roles: { some: { role: { name: 'CUSTOMER' } } } } }),
      this.prisma.product.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.productVariant.findMany({ where: { deletedAt: null, product: { deletedAt: null } }, select: { stockOnHand: true, lowStockThreshold: true } }),
      this.prisma.offer.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.coupon.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.couponRedemption.count({ where: { createdAt: { gte: monthAgo } } }),
      this.prisma.cart.count({ where: { status: 'ACTIVE', lastActivityAt: { lte: new Date(Date.now() - 24 * 3600 * 1000) }, items: { some: {} } } }),
    ]);

    return {
      sales: {
        total: dec(totalSales._sum.total),
        today: dec(todaySales._sum.total),
        todayOrders: todaySales._count._all,
        week: dec(weekSales._sum.total),
        month: dec(monthSales._sum.total),
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        returnsPending: pendingReturns,
        refundsPending: pendingRefunds,
      },
      customers: { total: totalCustomers, newThisMonth: newCustomers },
      products: {
        active: activeProducts,
        lowStock: variants.filter((v) => v.stockOnHand > 0 && v.stockOnHand <= v.lowStockThreshold).length,
        outOfStock: variants.filter((v) => v.stockOnHand <= 0).length,
      },
      marketing: { activeOffers, activeCoupons, monthRedemptions, abandonedCarts },
    };
  }

  // ---------------- Charts ----------------

  @RequirePerms('dashboard.view')
  @Get('charts')
  async charts(@Query() query: unknown) {
    const dto = validate(rangeSchema, query);
    const { from, to } = rangeToDates(dto);
    const statusList = Prisma.join(COUNTED);

    const [revenueByDay, statusGroups, methodGroups, topProducts, customersByDay] = await Promise.all([
      this.prisma.$queryRaw<Array<{ d: Date; revenue: number; orders: number }>>`
        SELECT CAST(placedAt AS date) AS d, SUM(total) AS revenue, COUNT(*) AS orders
        FROM [Order]
        WHERE placedAt >= ${from} AND placedAt <= ${to} AND status IN (${statusList})
        GROUP BY CAST(placedAt AS date)
        ORDER BY d`,
      this.prisma.order.groupBy({
        by: ['status'],
        where: { placedAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['paymentMethod'],
        where: { placedAt: { gte: from, lte: to }, status: { in: COUNTED } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.$queryRaw<Array<{ productId: string; name: string; qty: number; revenue: number }>>`
        SELECT TOP 10 oi.productId, oi.nameSnapshot AS name, SUM(oi.qty) AS qty, SUM(oi.lineTotal) AS revenue
        FROM OrderItem oi
        INNER JOIN [Order] o ON o.id = oi.orderId
        WHERE o.placedAt >= ${from} AND o.placedAt <= ${to} AND o.status IN (${statusList})
        GROUP BY oi.productId, oi.nameSnapshot
        ORDER BY revenue DESC`,
      this.prisma.$queryRaw<Array<{ d: Date; customers: number }>>`
        SELECT CAST(u.createdAt AS date) AS d, COUNT(*) AS customers
        FROM [User] u
        WHERE u.createdAt >= ${from} AND u.createdAt <= ${to} AND u.deletedAt IS NULL
        GROUP BY CAST(u.createdAt AS date)
        ORDER BY d`,
    ]);

    return {
      from, to,
      revenueByDay: revenueByDay.map((r) => ({ date: r.d, revenue: dec(r.revenue), orders: Number(r.orders) })),
      ordersByStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      paymentMethods: methodGroups.map((g) => ({
        method: g.paymentMethod ?? 'unknown',
        orders: g._count._all,
        value: dec(g._sum.total),
      })),
      topProducts: topProducts.map((p) => ({ productId: p.productId, name: p.name, qty: Number(p.qty), revenue: dec(p.revenue) })),
      newCustomersByDay: customersByDay.map((c) => ({ date: c.d, customers: Number(c.customers) })),
    };
  }

  // ---------------- Payment method report ----------------

  @RequirePerms('reports.read')
  @Get('payment-methods')
  async paymentMethods(@Query() query: unknown) {
    const dto = validate(rangeSchema, query);
    const { from, to } = rangeToDates(dto);
    const groups = await this.prisma.payment.groupBy({
      by: ['method', 'status'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { amount: true },
    });
    const methods = new Map<string, { orders: number; value: number; success: number; failed: number; refunded: number }>();
    for (const g of groups) {
      const key = g.method ?? 'unknown';
      const m = methods.get(key) ?? { orders: 0, value: 0, success: 0, failed: 0, refunded: 0 };
      m.orders += g._count._all;
      if (g.status === 'SUCCESS') {
        m.success += g._count._all;
        m.value += dec(g._sum.amount);
      }
      if (g.status === 'FAILED') m.failed += g._count._all;
      if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(g.status)) {
        m.refunded += g._count._all;
        m.value += dec(g._sum.amount);
      }
      methods.set(key, m);
    }
    return Array.from(methods.entries()).map(([method, stats]) => ({ method, ...stats }));
  }

  // ---------------- Product performance ----------------

  @RequirePerms('reports.read')
  @Get('products')
  async products(@Query() query: unknown) {
    const dto = validate(rangeSchema, query);
    const { from, to } = rangeToDates(dto);
    const statusList = Prisma.join(COUNTED);
    const [best, mostViewed, mostWishlisted] = await Promise.all([
      this.prisma.$queryRaw<Array<{ productId: string; name: string; qty: number; revenue: number }>>`
        SELECT TOP 20 oi.productId, oi.nameSnapshot AS name, SUM(oi.qty) AS qty, SUM(oi.lineTotal) AS revenue
        FROM OrderItem oi INNER JOIN [Order] o ON o.id = oi.orderId
        WHERE o.placedAt >= ${from} AND o.placedAt <= ${to} AND o.status IN (${statusList})
        GROUP BY oi.productId, oi.nameSnapshot ORDER BY qty DESC`,
      this.prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { viewCount: 'desc' },
        take: 10,
        select: { id: true, name: true, viewCount: true, soldCount: true },
      }),
      this.prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { wishlistCount: 'desc' },
        take: 10,
        select: { id: true, name: true, wishlistCount: true },
      }),
    ]);
    return {
      bestSellers: best.map((b) => ({ ...b, qty: Number(b.qty), revenue: dec(b.revenue) })),
      mostViewed,
      mostWishlisted,
    };
  }

  // ---------------- Customer report ----------------

  @RequirePerms('reports.read')
  @Get('customers')
  async customers(@Query() query: unknown) {
    const dto = validate(rangeSchema, query);
    const { from, to } = rangeToDates(dto);
    const statusList = Prisma.join(COUNTED);
    const [topSpenders, returning] = await Promise.all([
      this.prisma.$queryRaw<Array<{ userId: string; name: string; orders: number; spent: number }>>`
        SELECT TOP 20 o.userId, u.name, COUNT(*) AS orders, SUM(o.total) AS spent
        FROM [Order] o INNER JOIN [User] u ON u.id = o.userId
        WHERE o.placedAt >= ${from} AND o.placedAt <= ${to} AND o.status IN (${statusList})
        GROUP BY o.userId, u.name ORDER BY spent DESC`,
      this.prisma.$queryRaw<Array<{ repeatCustomers: number; totalCustomers: number }>>`
        SELECT
          SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) AS repeatCustomers,
          COUNT(*) AS totalCustomers
        FROM (
          SELECT userId, COUNT(*) AS cnt FROM [Order]
          WHERE placedAt >= ${from} AND placedAt <= ${to} AND status IN (${statusList})
          GROUP BY userId
        ) t`,
    ]);
    return {
      topSpenders: topSpenders.map((t) => ({ ...t, orders: Number(t.orders), spent: dec(t.spent) })),
      repeatCustomers: Number(returning[0]?.repeatCustomers ?? 0),
      purchasingCustomers: Number(returning[0]?.totalCustomers ?? 0),
    };
  }
}
