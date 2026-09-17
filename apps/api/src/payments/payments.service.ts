import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_GATEWAY, PaymentGateway, MockPayGateway } from './gateway';
import { dec, toJson } from '../common/utils';
import { canTransitionOrder, canTransitionPayment } from '@shopcraft/shared';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  // ---------------- Payment intents ----------------

  /** Create a gateway order + local payment record for an order awaiting payment. */
  async createPaymentIntent(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status)) {
      throw new BadRequestException('This order is not awaiting payment.');
    }
    const amountPaise = Math.round(dec(order.total) * 100);
    const gwOrder = await this.gateway.createOrder({
      amountPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: order.id },
    });
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: this.gateway.name,
        providerOrderId: gwOrder.providerOrderId,
        amount: order.total,
        currency: 'INR',
        status: 'CREATED',
      },
    });
    return gwOrder;
  }

  /** Customer retries a failed payment: fresh gateway order, same platform order. */
  async retryPayment(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status)) {
      throw new BadRequestException('This order can no longer be paid.');
    }
    if (order.status === 'PAYMENT_FAILED') {
      await this.transitionOrder(order.id, 'PENDING_PAYMENT', 'Payment retry started', null);
    }
    const gwOrder = await this.createPaymentIntent(order.id);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      checkout: {
        ...gwOrder.checkout,
        keyId: this.gateway.name === 'razorpay' ? process.env.RAZORPAY_KEY_ID : undefined,
      },
    };
  }

  // ---------------- Verification (handshake) ----------------

  /**
   * Called by the frontend after the gateway checkout reports success.
   * The signature is verified server-side with the gateway secret — the
   * frontend's claim alone NEVER marks anything paid.
   */
  async verifyCallback(userId: string, dto: { orderId: string; providerOrderId: string; providerPaymentId: string; signature: string }) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId: dto.providerOrderId, orderId: dto.orderId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('Payment session not found.');
    if (payment.order.userId !== userId) throw new ForbiddenException('Invalid payment session.');

    const valid = this.gateway.verifyCallbackSignature({
      providerOrderId: dto.providerOrderId,
      providerPaymentId: dto.providerPaymentId,
      signature: dto.signature,
    });
    if (!valid) {
      this.logger.warn(`Signature verification FAILED for order ${payment.orderId}`);
      throw new BadRequestException('Payment verification failed. If money was deducted it will be auto-refunded by the gateway.');
    }

    await this.confirmPaymentSuccess(payment.id, dto.providerPaymentId, undefined);
    return { verified: true, orderId: payment.orderId, orderNumber: payment.order.orderNumber };
  }

  // ---------------- Confirmation core (idempotent) ----------------

  /** Payment verified → mark paid, confirm order, convert stock reservation to sale. */
  async confirmPaymentSuccess(paymentId: string, providerPaymentId: string, method?: string) {
    const affectedVariants: string[] = [];
    const result = await this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
          include: { order: { include: { items: true } } },
        });
        if (payment.status === 'SUCCESS') return { already: true, order: payment.order };
        if (!canTransitionPayment(payment.status as any, 'SUCCESS')) {
          throw new BadRequestException(`Payment in state ${payment.status} cannot be confirmed.`);
        }
        const order = payment.order;
        if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status)) {
          // webhook raced the callback — payment row updated, order already confirmed
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'SUCCESS', providerPaymentId, method, verifiedAt: new Date() },
          });
          return { already: true, order };
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', providerPaymentId, method, verifiedAt: new Date() },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'SUCCESS',
            paymentMethod: method ?? order.paymentMethod,
            confirmedAt: new Date(),
          },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, fromStatus: order.status, toStatus: 'CONFIRMED', note: 'Payment verified' },
        });

        for (const item of order.items) {
          await this.inventory.commitSale(tx, item.variantId, item.qty, order.id);
          await tx.product.update({ where: { id: item.productId }, data: { soldCount: { increment: item.qty } } });
          affectedVariants.push(item.variantId);
        }

        if (order.couponCode) {
          const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } });
          if (coupon) {
            const exists = await tx.couponRedemption.findUnique({
              where: { couponId_orderId: { couponId: coupon.id, orderId: order.id } },
            });
            if (!exists) {
              await tx.couponRedemption.create({
                data: { couponId: coupon.id, userId: order.userId, orderId: order.id, amount: order.couponDiscount },
              });
              await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
            }
          }
        }

        await tx.cart.updateMany({
          where: { userId: order.userId, status: 'ACTIVE' },
          data: { status: 'CONVERTED', couponCode: null },
        });
        return { already: false, order };
      },
      { timeout: 20_000 },
    );

    if (!result.already) {
      await this.afterOrderConfirmed(result.order.id);
      await this.inventory.checkLowStock(affectedVariants);
    }
    return result.order;
  }

  /** COD: no online payment — order confirms immediately, payment collected on delivery. */
  async confirmCodOrder(orderId: string) {
    const affectedVariants: string[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
        if (order.status !== 'PENDING_PAYMENT') return;
        await tx.payment.create({
          data: { orderId: order.id, provider: 'cod', amount: order.total, currency: 'INR', status: 'PENDING', method: 'cod' },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CONFIRMED', paymentStatus: 'PENDING', confirmedAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', note: 'Cash on Delivery order confirmed' },
        });
        for (const item of order.items) {
          await this.inventory.commitSale(tx, item.variantId, item.qty, order.id);
          await tx.product.update({ where: { id: item.productId }, data: { soldCount: { increment: item.qty } } });
          affectedVariants.push(item.variantId);
        }
        if (order.couponCode) {
          const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } });
          if (coupon) {
            await tx.couponRedemption.create({
              data: { couponId: coupon.id, userId: order.userId, orderId: order.id, amount: order.couponDiscount },
            });
            await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
          }
        }
        await tx.cart.updateMany({
          where: { userId: order.userId, status: 'ACTIVE' },
          data: { status: 'CONVERTED', couponCode: null },
        });
      },
      { timeout: 20_000 },
    );
    await this.afterOrderConfirmed(orderId);
    await this.inventory.checkLowStock(affectedVariants);
  }

  private async afterOrderConfirmed(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { user: true, items: true },
    });
    const itemSummary = order.items.map((i) => `${i.nameSnapshot} × ${i.qty}`).join(', ');
    await this.notifications.notifyUser(order.userId, {
      type: 'ORDER_PLACED',
      title: `Order ${order.orderNumber} confirmed`,
      body: `We're preparing your order: ${itemSummary}.`,
      data: { orderId: order.id, orderNumber: order.orderNumber },
      email: order.user.email
        ? {
            to: order.user.email,
            subject: `Your ShopCraft order ${order.orderNumber} is confirmed`,
            html: `<h2>Thanks for your order!</h2><p>Order <b>${order.orderNumber}</b> · Total ₹${dec(order.total)}</p><p>${itemSummary}</p>`,
          }
        : undefined,
    });
    await this.notifications.notifyAdmins({
      type: 'NEW_ORDER',
      title: `New order ${order.orderNumber}`,
      body: `₹${dec(order.total)} · ${order.items.length} item(s) · ${order.paymentMethod?.toUpperCase()}`,
      data: { orderId: order.id },
    });
  }

  // ---------------- Failure ----------------

  async markPaymentFailed(providerOrderId: string, reason?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment || payment.status === 'FAILED' || payment.status === 'SUCCESS') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', errorReason: reason?.slice(0, 400) },
    });
    if (payment.order.status === 'PENDING_PAYMENT') {
      await this.transitionOrder(payment.orderId, 'PAYMENT_FAILED', reason ?? 'Payment failed', null);
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'FAILED' } });
    }
    await this.notifications.notifyUser(payment.order.userId, {
      type: 'PAYMENT_FAILED',
      title: 'Payment failed',
      body: `Payment for order ${payment.order.orderNumber} did not go through. You can retry from your orders page — no money is charged for failed attempts.`,
      data: { orderId: payment.orderId },
    });
    await this.notifications.notifyAdmins({
      type: 'ADMIN_PAYMENT_FAILED',
      title: `Payment failed for ${payment.order.orderNumber}`,
      body: reason ?? 'Gateway reported failure',
      data: { orderId: payment.orderId },
    });
  }

  // ---------------- Webhooks (idempotent) ----------------

  async handleWebhook(rawBody: Buffer, signature: string | undefined, payload: any) {
    if (!signature || !this.gateway.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    const event = this.gateway.parseWebhook(payload);

    // Idempotency: a provider event is processed exactly once
    try {
      await this.prisma.webhookEvent.create({
        data: { provider: this.gateway.name, eventId: event.eventId, type: event.type, payload: toJson(payload) },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { ok: true, duplicate: true };
      }
      throw err;
    }

    let error: string | null = null;
    try {
      if (event.type === 'payment.captured' && event.providerOrderId && event.providerPaymentId) {
        const payment = await this.prisma.payment.findFirst({
          where: { providerOrderId: event.providerOrderId },
          orderBy: { createdAt: 'desc' },
        });
        if (payment) await this.confirmPaymentSuccess(payment.id, event.providerPaymentId, event.method);
      } else if (event.type === 'payment.failed' && event.providerOrderId) {
        await this.markPaymentFailed(event.providerOrderId, event.errorReason);
      } else if (event.type === 'refund.processed' && event.providerRefundId) {
        await this.prisma.refund.updateMany({
          where: { providerRefundId: event.providerRefundId, status: { in: ['PENDING', 'PROCESSING'] } },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    } catch (err) {
      error = (err as Error).message;
      this.logger.error(`Webhook processing error: ${error}`);
    }
    await this.prisma.webhookEvent.updateMany({
      where: { provider: this.gateway.name, eventId: event.eventId },
      data: { processedAt: new Date(), error },
    });
    return { ok: true };
  }

  // ---------------- Refunds ----------------

  /** Issue a (full or partial) refund through the gateway. Used by admin + auto-refund on cancellation. */
  async issueRefund(orderId: string, amount: number, reason: string | undefined, actorId: string | null) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new BadRequestException('No captured payment found for this order.');

    const refundedSoFar = await this.prisma.refund.aggregate({
      where: { orderId, status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] } },
      _sum: { amount: true },
    });
    const remaining = dec(payment.amount) - dec(refundedSoFar._sum.amount);
    if (amount > remaining + 0.01) {
      throw new BadRequestException(`Refund exceeds refundable amount (₹${remaining.toFixed(2)} remaining).`);
    }

    let providerRefundId: string | null = null;
    let status: 'PROCESSING' | 'COMPLETED' = 'PROCESSING';
    if (payment.provider === 'cod') {
      status = 'COMPLETED'; // manual refund (bank transfer/UPI) recorded by admin
    } else if (payment.providerPaymentId) {
      const result = await this.gateway.createRefund(payment.providerPaymentId, Math.round(amount * 100));
      providerRefundId = result.providerRefundId;
      status = result.status === 'processed' ? 'COMPLETED' : 'PROCESSING';
    }

    const refund = await this.prisma.refund.create({
      data: {
        orderId,
        paymentId: payment.id,
        amount,
        reason,
        status,
        providerRefundId,
        initiatedById: actorId,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });

    const totalRefunded = dec(refundedSoFar._sum.amount) + amount;
    const fullyRefunded = totalRefunded >= dec(payment.amount) - 0.01;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });
    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });

    await this.notifications.notifyUser(payment.order.userId, {
      type: 'REFUND_PROCESSED',
      title: `Refund of ₹${amount.toFixed(2)} initiated`,
      body: `Your refund for order ${payment.order.orderNumber} has been ${status === 'COMPLETED' ? 'processed' : 'initiated'}. It may take 5–7 business days to reflect.`,
      data: { orderId, refundId: refund.id },
    });
    return refund;
  }

  // ---------------- Helpers ----------------

  async transitionOrder(orderId: string, toStatus: string, note: string | null, actorId: string | null) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!canTransitionOrder(order.status as any, toStatus as any)) {
      throw new BadRequestException(`Order cannot move from ${order.status} to ${toStatus}.`);
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { status: toStatus } });
    await this.prisma.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus, note, actorId },
    });
  }

  // ---------------- MockPay simulator (development only) ----------------

  /**
   * Simulates what the MockPay hosted checkout would do: on success it returns
   * a SIGNED payment result the frontend must still submit to /payments/verify
   * (exact Razorpay handshake); on failure it reports failure to the platform.
   */
  async mockSimulate(userId: string, dto: { orderId: string; outcome: 'success' | 'failure' }) {
    if (this.gateway.name !== 'mock') {
      throw new BadRequestException('Mock payments are disabled on this server.');
    }
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId, provider: 'mock', status: { in: ['CREATED', 'PENDING'] } },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment || payment.order.userId !== userId) throw new NotFoundException('Payment session not found.');

    if (dto.outcome === 'failure') {
      await this.markPaymentFailed(payment.providerOrderId!, 'Simulated payment failure (dev)');
      return { outcome: 'failure' as const };
    }
    const mock = this.gateway as MockPayGateway;
    const providerPaymentId = 'mockpay_' + Math.random().toString(36).slice(2, 12);
    const signature = mock.sign(payment.providerOrderId!, providerPaymentId);
    return {
      outcome: 'success' as const,
      providerOrderId: payment.providerOrderId,
      providerPaymentId,
      signature,
    };
  }
}
