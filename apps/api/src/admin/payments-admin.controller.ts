import { Controller, Get, Header, Query } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dec, toCsv, validate } from '../common/utils';
import { RequirePerms } from '../auth/decorators';

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  method: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller('admin/payments')
export class PaymentsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePerms('payments.read')
  @Get()
  async list(@Query() query: unknown) {
    const dto = validate(listSchema, query);
    const where: Prisma.PaymentWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.method) where.method = dto.method;
    if (dto.from || dto.to) where.createdAt = { gte: dto.from, lte: dto.to };
    if (dto.q) {
      where.OR = [
        { providerPaymentId: { contains: dto.q } },
        { providerOrderId: { contains: dto.q } },
        { order: { orderNumber: { contains: dto.q } } },
        { order: { user: { name: { contains: dto.q } } } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        include: { order: { select: { id: true, orderNumber: true, user: { select: { name: true } } } } },
      }),
    ]);
    return {
      total, page: dto.page, pageSize: dto.pageSize,
      items: rows.map((p) => ({
        id: p.id,
        orderId: p.order.id,
        orderNumber: p.order.orderNumber,
        customer: p.order.user.name,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        method: p.method,
        status: p.status,
        amount: dec(p.amount),
        errorReason: p.errorReason,
        verifiedAt: p.verifiedAt,
        createdAt: p.createdAt,
      })),
    };
  }

  @RequirePerms('payments.read')
  @Get('refunds')
  async refunds(@Query('page') page = '1') {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = 25;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.refund.count(),
      this.prisma.refund.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * pageSize,
        take: pageSize,
        include: {
          order: { select: { id: true, orderNumber: true, user: { select: { name: true } } } },
          initiatedBy: { select: { name: true } },
        },
      }),
    ]);
    return {
      total, page: p, pageSize,
      items: rows.map((r) => ({
        id: r.id,
        orderId: r.order.id,
        orderNumber: r.order.orderNumber,
        customer: r.order.user.name,
        amount: dec(r.amount),
        status: r.status,
        reason: r.reason,
        providerRefundId: r.providerRefundId,
        initiatedBy: r.initiatedBy?.name ?? 'System',
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    };
  }

  @RequirePerms('payments.read')
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="payments.csv"')
  async export(@Query('from') from?: string, @Query('to') to?: string) {
    const rows = await this.prisma.payment.findMany({
      where: from || to ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } : {},
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true } } },
      take: 10_000,
    });
    return toCsv(
      ['Payment ID', 'Order', 'Provider', 'Gateway Payment ID', 'Method', 'Status', 'Amount', 'Date'],
      rows.map((p) => [p.id, p.order.orderNumber, p.provider, p.providerPaymentId ?? '', p.method ?? '', p.status, dec(p.amount), p.createdAt.toISOString()]),
    );
  }
}
