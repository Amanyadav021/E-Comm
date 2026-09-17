import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/audit.service';
import { dec, fromJson, toCsv } from '../common/utils';
import { canTransitionOrder, canTransitionReturn, type OrderStatus, type NotificationType } from '@shopcraft/shared';

const STATUS_NOTIFICATIONS: Partial<Record<OrderStatus, { type: NotificationType; title: (n: string) => string; body: string }>> = {
  PROCESSING: { type: 'ORDER_PLACED', title: (n) => `Order ${n} is being processed`, body: 'We are preparing your items.' },
  PACKED: { type: 'ORDER_PACKED', title: (n) => `Order ${n} packed`, body: 'Your order has been packed and will ship soon.' },
  SHIPPED: { type: 'ORDER_SHIPPED', title: (n) => `Order ${n} shipped`, body: 'Your order is on the way.' },
  OUT_FOR_DELIVERY: { type: 'ORDER_OUT_FOR_DELIVERY', title: (n) => `Order ${n} is out for delivery`, body: 'Your order will arrive today.' },
  DELIVERED: { type: 'ORDER_DELIVERED', title: (n) => `Order ${n} delivered`, body: 'Enjoy! You can rate your products from the order page.' },
};

@Injectable()
export class OrdersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: {
    q?: string; status?: string; paymentStatus?: string; from?: Date; to?: Date;
    page: number; pageSize: number;
  }) {
    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.from || query.to) where.placedAt = { gte: query.from, lte: query.to };
    if (query.q) {
      where.OR = [
        { orderNumber: { contains: query.q } },
        { user: { name: { contains: query.q } } },
        { user: { email: { contains: query.q } } },
        { user: { phone: { contains: query.q } } },
        { trackingNumber: { contains: query.q } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { name: true, email: true, phone: true } }, items: { select: { qty: true } } },
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.user.name,
        customerContact: o.user.email ?? o.user.phone,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        total: dec(o.total),
        itemCount: o.items.reduce((s, i) => s + i.qty, 0),
        placedAt: o.placedAt,
      })),
    };
  }

  async detail(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        returnRequests: { include: { items: { include: { orderItem: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!o) throw new NotFoundException('Order not found');
    const orderCount = await this.prisma.order.count({
      where: { userId: o.userId, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'] } },
    });
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      allowedTransitions: this.allowedAdminTransitions(o.status as OrderStatus),
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      customer: { ...o.user, orderCount },
      shippingAddress: fromJson(o.shippingAddress, {}),
      amounts: {
        subtotal: dec(o.subtotal),
        productDiscount: dec(o.productDiscount),
        offerDiscount: dec(o.offerDiscount),
        couponDiscount: dec(o.couponDiscount),
        couponCode: o.couponCode,
        shippingFee: dec(o.shippingFee),
        taxAmount: dec(o.taxAmount),
        total: dec(o.total),
      },
      trackingNumber: o.trackingNumber,
      courierName: o.courierName,
      expectedDeliveryAt: o.expectedDeliveryAt,
      customerNote: o.customerNote,
      adminNote: o.adminNote,
      cancelReason: o.cancelReason,
      placedAt: o.placedAt,
      confirmedAt: o.confirmedAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
      cancelledAt: o.cancelledAt,
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.nameSnapshot,
        sku: i.skuSnapshot,
        image: i.imageSnapshot,
        options: fromJson(i.optionsSnapshot, {}),
        unitMrp: dec(i.unitMrp),
        unitPrice: dec(i.unitPrice),
        qty: i.qty,
        lineTotal: dec(i.lineTotal),
        returnedQty: i.returnedQty,
      })),
      timeline: o.statusHistory.map((h) => ({
        from: h.fromStatus, to: h.toStatus, note: h.note, at: h.createdAt, by: h.actor?.name ?? 'System',
      })),
      payments: o.payments.map((p) => ({
        id: p.id, provider: p.provider, providerOrderId: p.providerOrderId, providerPaymentId: p.providerPaymentId,
        status: p.status, method: p.method, amount: dec(p.amount), errorReason: p.errorReason,
        verifiedAt: p.verifiedAt, createdAt: p.createdAt,
      })),
      refunds: o.refunds.map((r) => ({
        id: r.id, amount: dec(r.amount), status: r.status, reason: r.reason,
        providerRefundId: r.providerRefundId, createdAt: r.createdAt, completedAt: r.completedAt,
      })),
      returnRequests: o.returnRequests.map((rr) => ({
        id: rr.id, status: rr.status, reason: rr.reason, comments: rr.comments, adminComment: rr.adminComment,
        refundAmount: rr.refundAmount == null ? null : dec(rr.refundAmount), createdAt: rr.createdAt,
        items: rr.items.map((ri) => ({ name: ri.orderItem.nameSnapshot, qty: ri.qty, unitPrice: dec(ri.orderItem.unitPrice) })),
      })),
    };
  }

  private allowedAdminTransitions(status: OrderStatus): string[] {
    // Admin drives fulfillment transitions; payment transitions come from the gateway
    const fulfillment = ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    return (
      {
        CONFIRMED: ['PROCESSING', 'CANCELLED'],
        PROCESSING: ['PACKED', 'CANCELLED'],
        PACKED: ['SHIPPED', 'CANCELLED'],
        SHIPPED: ['OUT_FOR_DELIVERY'],
        OUT_FOR_DELIVERY: ['DELIVERED'],
      } as Record<string, string[]>
    )[status] ?? [];
  }

  async updateStatus(
    id: string,
    dto: { status: string; note?: string; trackingNumber?: string; courierName?: string },
    actorId: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true, user: true, payments: true } });
    if (!order) throw new NotFoundException('Order not found');
    const to = dto.status as OrderStatus;
    if (!canTransitionOrder(order.status as OrderStatus, to)) {
      throw new BadRequestException(`Order cannot move from ${order.status} to ${to}.`);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id },
          data: {
            status: to,
            trackingNumber: dto.trackingNumber ?? order.trackingNumber,
            courierName: dto.courierName ?? order.courierName,
            shippedAt: to === 'SHIPPED' ? new Date() : order.shippedAt,
            deliveredAt: to === 'DELIVERED' ? new Date() : order.deliveredAt,
            cancelledAt: to === 'CANCELLED' ? new Date() : order.cancelledAt,
            cancelReason: to === 'CANCELLED' ? (dto.note ?? 'Cancelled by store') : order.cancelReason,
          },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: id, fromStatus: order.status, toStatus: to, note: dto.note, actorId },
        });

        if (to === 'CANCELLED') {
          const wasConfirmed = !['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status);
          for (const item of order.items) {
            if (wasConfirmed) {
              await this.inventory.restock(tx, item.variantId, item.qty, id, 'Order cancelled by admin');
              await tx.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: item.qty } } });
            } else {
              await this.inventory.release(tx, item.variantId, item.qty, id);
            }
          }
          await tx.payment.updateMany({
            where: { orderId: id, status: { in: ['CREATED', 'PENDING'] } },
            data: { status: 'CANCELLED' },
          });
        }

        // COD: cash is collected at delivery
        if (to === 'DELIVERED' && order.paymentMethod === 'cod') {
          await tx.payment.updateMany({
            where: { orderId: id, provider: 'cod', status: 'PENDING' },
            data: { status: 'SUCCESS', verifiedAt: new Date() },
          });
          await tx.order.update({ where: { id }, data: { paymentStatus: 'SUCCESS' } });
        }
      },
      { timeout: 20_000 },
    );

    // Auto-refund captured payment when admin cancels
    if (to === 'CANCELLED') {
      const paid = order.payments.find((p) => p.status === 'SUCCESS');
      if (paid) await this.payments.issueRefund(id, dec(paid.amount), dto.note ?? 'Order cancelled by store', actorId);
      await this.notifications.notifyUser(order.userId, {
        type: 'ORDER_CANCELLED',
        title: `Order ${order.orderNumber} cancelled`,
        body: dto.note ?? 'Your order was cancelled by the store. Any payment will be refunded.',
        data: { orderId: id },
      });
    } else {
      const n = STATUS_NOTIFICATIONS[to];
      if (n) {
        await this.notifications.notifyUser(order.userId, {
          type: n.type,
          title: n.title(order.orderNumber),
          body: to === 'SHIPPED' && dto.trackingNumber ? `Tracking: ${dto.trackingNumber} (${dto.courierName ?? 'courier'})` : n.body,
          data: { orderId: id },
          email: order.user.email
            ? { to: order.user.email, subject: n.title(order.orderNumber), html: `<p>${n.body}</p>` }
            : undefined,
        });
      }
    }

    await this.audit.log({ actorId, action: 'order.status_change', entity: 'Order', entityId: id, metadata: { from: order.status, to, note: dto.note } });
    return this.detail(id);
  }

  async setAdminNote(id: string, note: string, actorId: string) {
    await this.prisma.order.update({ where: { id }, data: { adminNote: note } });
    await this.audit.log({ actorId, action: 'order.note', entity: 'Order', entityId: id });
    return { ok: true };
  }

  async refund(id: string, dto: { amount: number; reason?: string }, actorId: string) {
    const refund = await this.payments.issueRefund(id, dto.amount, dto.reason, actorId);
    await this.audit.log({ actorId, action: 'order.refund', entity: 'Order', entityId: id, metadata: { amount: dto.amount, reason: dto.reason } });
    return refund;
  }

  // ---------------- Returns ----------------

  async listReturns(status: string | undefined, page: number, pageSize: number) {
    const where: Prisma.ReturnRequestWhereInput = status ? { status } : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          order: { select: { orderNumber: true, total: true } },
          user: { select: { name: true } },
          items: { include: { orderItem: true } },
        },
      }),
    ]);
    return {
      total, page, pageSize,
      items: rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNumber: r.order.orderNumber,
        customer: r.user.name,
        status: r.status,
        reason: r.reason,
        itemCount: r.items.reduce((s, i) => s + i.qty, 0),
        estimatedValue: r.items.reduce((s, i) => s + dec(i.orderItem.unitPrice) * i.qty, 0),
        createdAt: r.createdAt,
      })),
    };
  }

  async updateReturn(
    id: string,
    dto: { status: string; adminComment?: string; refundAmount?: number },
    actorId: string,
  ) {
    const rr = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { payments: true } }, items: { include: { orderItem: true } } },
    });
    if (!rr) throw new NotFoundException('Return request not found');
    if (!canTransitionReturn(rr.status as any, dto.status as any)) {
      throw new BadRequestException(`Return cannot move from ${rr.status} to ${dto.status}.`);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.returnRequest.update({
          where: { id },
          data: {
            status: dto.status,
            adminComment: dto.adminComment ?? rr.adminComment,
            refundAmount: dto.refundAmount ?? rr.refundAmount,
            resolvedById: actorId,
            resolvedAt: ['REJECTED', 'COMPLETED'].includes(dto.status) ? new Date() : null,
          },
        });

        if (dto.status === 'REJECTED') {
          // order returns to DELIVERED
          await tx.order.update({ where: { id: rr.orderId }, data: { status: 'DELIVERED' } });
          await tx.orderStatusHistory.create({
            data: { orderId: rr.orderId, fromStatus: 'RETURN_REQUESTED', toStatus: 'DELIVERED', note: `Return rejected: ${dto.adminComment ?? ''}`, actorId },
          });
        }

        if (dto.status === 'RECEIVED') {
          for (const item of rr.items) {
            await this.inventory.restock(tx, item.orderItem.variantId, item.qty, rr.orderId, 'Return received');
            await tx.orderItem.update({
              where: { id: item.orderItemId },
              data: { returnedQty: { increment: item.qty } },
            });
          }
          await tx.order.update({ where: { id: rr.orderId }, data: { status: 'RETURNED' } });
          await tx.orderStatusHistory.create({
            data: { orderId: rr.orderId, fromStatus: 'RETURN_REQUESTED', toStatus: 'RETURNED', note: 'Return items received', actorId },
          });
        }
      },
      { timeout: 20_000 },
    );

    // Refund on completion (or explicit REFUND_PROCESSING step)
    if (dto.status === 'REFUND_PROCESSING' || dto.status === 'COMPLETED') {
      const amount =
        dto.refundAmount ??
        (rr.refundAmount != null ? dec(rr.refundAmount) : rr.items.reduce((s, i) => s + dec(i.orderItem.unitPrice) * i.qty, 0));
      const paid = rr.order.payments.find((p) => ['SUCCESS', 'PARTIALLY_REFUNDED'].includes(p.status));
      if (paid && amount > 0) {
        const existingRefunds = await this.prisma.refund.count({ where: { orderId: rr.orderId, reason: { contains: `return ${rr.id}` } } });
        if (existingRefunds === 0) {
          await this.payments.issueRefund(rr.orderId, amount, `Refund for return ${rr.id}`, actorId);
        }
      }
      if (dto.status === 'COMPLETED') {
        const order = await this.prisma.order.findUnique({ where: { id: rr.orderId } });
        if (order && order.status === 'RETURNED') {
          await this.prisma.order.update({ where: { id: rr.orderId }, data: { status: 'REFUNDED' } });
          await this.prisma.orderStatusHistory.create({
            data: { orderId: rr.orderId, fromStatus: 'RETURNED', toStatus: 'REFUNDED', note: 'Return refund completed', actorId },
          });
        }
      }
    }

    await this.notifications.notifyUser(rr.userId, {
      type: 'RETURN_UPDATE',
      title: `Return update for order ${rr.order.orderNumber}`,
      body:
        dto.status === 'APPROVED' ? 'Your return was approved. We will arrange a pickup soon.'
        : dto.status === 'REJECTED' ? `Your return was not approved. ${dto.adminComment ?? ''}`
        : dto.status === 'RECEIVED' ? 'We received your returned items. Your refund is being processed.'
        : dto.status === 'COMPLETED' ? 'Your return is complete and the refund has been processed.'
        : 'Your return request status was updated.',
      data: { orderId: rr.orderId, returnRequestId: rr.id },
    });
    await this.audit.log({ actorId, action: 'return.status_change', entity: 'ReturnRequest', entityId: id, metadata: { from: rr.status, to: dto.status } });
    return { ok: true };
  }

  // ---------------- Export ----------------

  async exportCsv(from?: Date, to?: Date) {
    const rows = await this.prisma.order.findMany({
      where: from || to ? { placedAt: { gte: from, lte: to } } : {},
      orderBy: { placedAt: 'desc' },
      include: { user: { select: { name: true, email: true, phone: true } }, items: { select: { qty: true } } },
      take: 10_000,
    });
    return toCsv(
      ['Order Number', 'Date', 'Customer', 'Contact', 'Items', 'Status', 'Payment Status', 'Payment Method', 'Subtotal', 'Discounts', 'Shipping', 'Total'],
      rows.map((o) => [
        o.orderNumber,
        o.placedAt.toISOString(),
        o.user.name,
        o.user.email ?? o.user.phone ?? '',
        o.items.reduce((s, i) => s + i.qty, 0),
        o.status,
        o.paymentStatus,
        o.paymentMethod ?? '',
        dec(o.subtotal),
        dec(o.productDiscount) + dec(o.offerDiscount) + dec(o.couponDiscount),
        dec(o.shippingFee),
        dec(o.total),
      ]),
    );
  }
}
