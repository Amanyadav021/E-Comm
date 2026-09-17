import { Body, Controller, Get, Header, Param, Patch, Query } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { dec, toCsv, validate } from '../common/utils';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'DISABLED']), reason: z.string().max(300).optional() });

@Controller('admin/customers')
export class CustomersAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @RequirePerms('customers.read')
  @Get()
  async list(@Query() query: unknown) {
    const dto = validate(listSchema, query);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: { some: { role: { name: 'CUSTOMER' } } },
    };
    if (dto.q) {
      where.OR = [{ name: { contains: dto.q } }, { email: { contains: dto.q } }, { phone: { contains: dto.q } }];
    }
    if (dto.status) where.status = dto.status;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
      }),
    ]);

    const ids = rows.map((u) => u.id);
    const spending = ids.length
      ? await this.prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'] } },
          _sum: { total: true },
          _count: { _all: true },
        })
      : [];
    const spendMap = new Map(spending.map((s) => [s.userId, { total: dec(s._sum.total), orders: s._count._all }]));

    return {
      total, page: dto.page, pageSize: dto.pageSize,
      items: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        orderCount: spendMap.get(u.id)?.orders ?? 0,
        totalSpent: spendMap.get(u.id)?.total ?? 0,
      })),
    };
  }

  @RequirePerms('customers.read')
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="customers.csv"')
  async export() {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: 'CUSTOMER' } } } },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    return toCsv(
      ['Name', 'Email', 'Phone', 'Status', 'Joined', 'Last Login'],
      rows.map((u) => [u.name, u.email ?? '', u.phone ?? '', u.status, u.createdAt.toISOString(), u.lastLoginAt?.toISOString() ?? '']),
    );
  }

  @RequirePerms('customers.read')
  @Get(':id')
  async detail(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: { where: { deletedAt: null } },
        wishlistItems: { include: { product: { select: { name: true, slug: true } } }, take: 20, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) return null;
    const [orders, agg, cart] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { placedAt: 'desc' },
        take: 20,
        include: { items: { select: { qty: true } } },
      }),
      this.prisma.order.aggregate({
        where: { userId: id, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'] } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.cart.findUnique({
        where: { userId: id },
        include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } } },
      }),
    ]);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: !!user.emailVerifiedAt,
      phoneVerified: !!user.phoneVerifiedAt,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      totalSpent: dec(agg._sum.total),
      orderCount: agg._count._all,
      addresses: user.addresses,
      wishlist: user.wishlistItems.map((w) => ({ name: w.product.name, slug: w.product.slug, addedAt: w.createdAt })),
      activeCart: cart && cart.status === 'ACTIVE'
        ? {
            lastActivityAt: cart.lastActivityAt,
            items: cart.items.map((i) => ({ name: i.variant.product.name, qty: i.qty, price: dec(i.variant.price) })),
          }
        : null,
      recentOrders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: dec(o.total),
        itemCount: o.items.reduce((s, i) => s + i.qty, 0),
        placedAt: o.placedAt,
      })),
    };
  }

  @RequirePerms('customers.write')
  @Patch(':id/status')
  async setStatus(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(statusSchema, body);
    await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
    if (dto.status === 'DISABLED') {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({
      actorId: admin.id, action: 'customer.status', entity: 'User', entityId: id,
      metadata: { status: dto.status, reason: dto.reason },
    });
    return { ok: true };
  }
}
