import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dec, fromJson } from '../common/utils';
import { CUSTOMER_CANCELLABLE, RETURN_ELIGIBLE, canTransitionReturn } from '@shopcraft/shared';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------- Customer order list & detail ----------------

  async listMine(userId: string, filter: 'all' | 'current' | 'delivered' | 'cancelled' | 'returned', page: number, pageSize = 10) {
    const statusFilter =
      filter === 'current'
        ? { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'] }
        : filter === 'delivered'
          ? { equals: 'DELIVERED' }
          : filter === 'cancelled'
            ? { equals: 'CANCELLED' }
            : filter === 'returned'
              ? { in: ['RETURN_REQUESTED', 'RETURNED', 'REFUNDED'] }
              : undefined;

    const where = { userId, ...(statusFilter ? { status: statusFilter } : {}) };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: dec(o.total),
        placedAt: o.placedAt,
        expectedDeliveryAt: o.expectedDeliveryAt,
        deliveredAt: o.deliveredAt,
        itemCount: o.items.reduce((s, i) => s + i.qty, 0),
        preview: o.items.slice(0, 3).map((i) => ({ name: i.nameSnapshot, image: i.imageSnapshot, qty: i.qty })),
      })),
    };
  }

  async getMine(userId: string, idOrNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { userId, OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      include: {
        items: { include: { reviews: { where: { userId } } } },
        statusHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        payments: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        returnRequests: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toDetail(order);
  }

  private toDetail(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingAddress: fromJson(order.shippingAddress, {}),
      subtotal: dec(order.subtotal),
      productDiscount: dec(order.productDiscount),
      offerDiscount: dec(order.offerDiscount),
      couponDiscount: dec(order.couponDiscount),
      couponCode: order.couponCode,
      shippingFee: dec(order.shippingFee),
      taxAmount: dec(order.taxAmount),
      total: dec(order.total),
      trackingNumber: order.trackingNumber,
      courierName: order.courierName,
      expectedDeliveryAt: order.expectedDeliveryAt,
      customerNote: order.customerNote,
      cancelReason: order.cancelReason,
      placedAt: order.placedAt,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
      canReturn: RETURN_ELIGIBLE.includes(order.status),
      canRetryPayment: ['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status),
      items: order.items.map((i: any) => ({
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
        reviewed: (i.reviews?.length ?? 0) > 0,
      })),
      timeline: order.statusHistory.map((h: any) => ({
        from: h.fromStatus,
        to: h.toStatus,
        note: h.note,
        at: h.createdAt,
      })),
      payments: order.payments.map((p: any) => ({
        id: p.id,
        provider: p.provider,
        status: p.status,
        method: p.method,
        amount: dec(p.amount),
        providerPaymentId: p.providerPaymentId,
        createdAt: p.createdAt,
      })),
      refunds: order.refunds.map((r: any) => ({
        id: r.id,
        amount: dec(r.amount),
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
      returnRequests: order.returnRequests?.map((rr: any) => ({
        id: rr.id,
        status: rr.status,
        reason: rr.reason,
        createdAt: rr.createdAt,
      })),
    };
  }

  // ---------------- Cancellation ----------------

  async cancel(userId: string, orderId: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!CUSTOMER_CANCELLABLE.includes(order.status as any)) {
      throw new BadRequestException('This order can no longer be cancelled. You can request a return after delivery.');
    }

    const wasConfirmed = !['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, fromStatus: order.status, toStatus: 'CANCELLED', note: `Cancelled by customer: ${reason}`, actorId: userId },
        });
        for (const item of order.items) {
          if (wasConfirmed) {
            await this.inventory.restock(tx, item.variantId, item.qty, order.id, 'Order cancelled');
            await tx.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: item.qty } } });
          } else {
            await this.inventory.release(tx, item.variantId, item.qty, order.id);
          }
        }
        // Pending gateway payments for this order are dead now
        await tx.payment.updateMany({
          where: { orderId: order.id, status: { in: ['CREATED', 'PENDING'] }, provider: { not: 'cod' } },
          data: { status: 'CANCELLED' },
        });
        await tx.payment.updateMany({
          where: { orderId: order.id, provider: 'cod', status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      },
      { timeout: 20_000 },
    );

    // Auto-refund captured online payments
    const paid = order.payments.find((p) => p.status === 'SUCCESS');
    if (paid) {
      await this.payments.issueRefund(order.id, dec(paid.amount), 'Order cancelled by customer', null);
    }

    await this.notifications.notifyUser(userId, {
      type: 'ORDER_CANCELLED',
      title: `Order ${order.orderNumber} cancelled`,
      body: paid ? 'Your refund has been initiated and will reflect in 5–7 business days.' : 'Your order was cancelled successfully.',
      data: { orderId: order.id },
    });
    await this.notifications.notifyAdmins({
      type: 'ORDER_CANCELLED_ADMIN',
      title: `Order ${order.orderNumber} cancelled by customer`,
      body: reason,
      data: { orderId: order.id },
    });
    return this.getMine(userId, order.id);
  }

  // ---------------- Returns ----------------

  async requestReturn(userId: string, dto: { orderId: string; reason: string; comments?: string; items: Array<{ orderItemId: string; qty: number }> }) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
      include: { items: true, returnRequests: { where: { status: { notIn: ['REJECTED', 'COMPLETED'] } } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!RETURN_ELIGIBLE.includes(order.status as any)) {
      throw new BadRequestException('Returns can only be requested for delivered orders.');
    }
    if (order.returnRequests.length > 0) {
      throw new BadRequestException('A return request is already in progress for this order.');
    }

    const itemsById = new Map(order.items.map((i) => [i.id, i]));
    for (const reqItem of dto.items) {
      const item = itemsById.get(reqItem.orderItemId);
      if (!item) throw new BadRequestException('Invalid item in return request.');
      if (reqItem.qty > item.qty - item.returnedQty) {
        throw new BadRequestException(`Return quantity for "${item.nameSnapshot}" exceeds what was purchased.`);
      }
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (product && !product.isReturnable) {
        throw new BadRequestException(`"${item.nameSnapshot}" is not eligible for return.`);
      }
      if (product && order.deliveredAt) {
        const deadline = new Date(order.deliveredAt);
        deadline.setDate(deadline.getDate() + product.returnWindowDays);
        if (new Date() > deadline) {
          throw new BadRequestException(`The ${product.returnWindowDays}-day return window for "${item.nameSnapshot}" has closed.`);
        }
      }
    }

    const request = await this.prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.create({
        data: {
          orderId: order.id,
          userId,
          reason: dto.reason,
          comments: dto.comments,
          items: { create: dto.items.map((i) => ({ orderItemId: i.orderItemId, qty: i.qty })) },
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'RETURN_REQUESTED' } });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: 'RETURN_REQUESTED', note: dto.reason, actorId: userId },
      });
      return rr;
    });

    await this.notifications.notifyAdmins({
      type: 'RETURN_REQUESTED_ADMIN',
      title: `Return requested for ${order.orderNumber}`,
      body: dto.reason,
      data: { orderId: order.id, returnRequestId: request.id },
    });
    return { id: request.id, status: request.status };
  }

  async listMyReturns(userId: string) {
    const rows = await this.prisma.returnRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true } }, items: { include: { orderItem: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      orderNumber: r.order.orderNumber,
      orderId: r.orderId,
      status: r.status,
      reason: r.reason,
      adminComment: r.adminComment,
      refundAmount: r.refundAmount == null ? null : dec(r.refundAmount),
      createdAt: r.createdAt,
      items: r.items.map((i) => ({ name: i.orderItem.nameSnapshot, qty: i.qty, image: i.orderItem.imageSnapshot })),
    }));
  }
}
