import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { dec, fromJson, generateOrderNumber, toJson, addDays } from '../common/utils';
import type { CheckoutInput, PricingLineInput } from '@shopcraft/shared';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Creates the order transactionally:
   *  - idempotent on idempotencyKey (safe double-click / network retry)
   *  - stock is reserved atomically (oversell-proof)
   *  - all amounts are recomputed server-side; nothing from the client is trusted
   * Online payments return a gateway checkout payload; the order stays
   * PENDING_PAYMENT until the gateway signature/webhook is verified.
   */
  async createOrder(userId: string, dto: CheckoutInput) {
    // Idempotency: same key returns the same order instead of creating a duplicate
    const existing = await this.prisma.order.findFirst({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing) {
      if (existing.userId !== userId) throw new BadRequestException('Invalid checkout session.');
      return this.checkoutResponseFor(existing.id);
    }

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('Please select a valid delivery address.');

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true, name: true, slug: true, categoryId: true, status: true, deletedAt: true,
                    taxRatePct: true, codAvailable: true,
                    images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { url: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const items = (cart?.items ?? []).filter(
      (i) => i.variant.isActive && !i.variant.deletedAt && i.variant.product.status === 'ACTIVE' && !i.variant.product.deletedAt,
    );
    if (!cart || items.length === 0) throw new BadRequestException('Your cart is empty.');

    const lines: PricingLineInput[] = items.map((i) => ({
      variantId: i.variantId,
      productId: i.variant.product.id,
      categoryId: i.variant.product.categoryId,
      qty: i.qty,
      mrp: dec(i.variant.mrp),
      price: dec(i.variant.price),
      taxRatePct: dec(i.variant.product.taxRatePct),
    }));

    const pricing = await this.pricing.priceLines({
      lines,
      couponCode: cart.couponCode,
      userId,
      pincode: address.pincode,
    });
    if (cart.couponCode && pricing.couponError) {
      throw new BadRequestException(`Coupon issue: ${pricing.couponError}`);
    }
    if (pricing.total <= 0) throw new BadRequestException('Order total is invalid.');

    if (dto.paymentMethod === 'cod') {
      if (pricing.zone && !pricing.zone.codAvailable) {
        throw new BadRequestException('Cash on Delivery is not available for your pincode.');
      }
      const nonCod = items.find((i) => !i.variant.product.codAvailable);
      if (nonCod) {
        throw new BadRequestException(`Cash on Delivery is not available for "${nonCod.variant.product.name}".`);
      }
    }

    const pricedByVariant = new Map(pricing.lines.map((l) => [l.variantId, l]));
    const addressSnapshot = {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      area: address.area,
      city: address.city,
      state: address.state,
      country: address.country,
      pincode: address.pincode,
      type: address.type,
    };
    const expectedDeliveryAt = addDays(new Date(), pricing.zone?.maxDeliveryDays ?? 7);

    // --- Transaction: create order + reserve stock atomically ---
    const order = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId,
            status: 'PENDING_PAYMENT',
            paymentStatus: 'PENDING',
            paymentMethod: dto.paymentMethod,
            shippingAddress: toJson(addressSnapshot),
            subtotal: pricing.subtotal,
            productDiscount: pricing.productDiscount,
            offerDiscount: pricing.offerDiscount,
            couponDiscount: pricing.couponDiscount,
            couponCode: pricing.couponDiscount > 0 ? pricing.couponCode : null,
            shippingFee: pricing.shippingFee,
            taxAmount: pricing.taxAmount,
            total: pricing.total,
            shippingZoneId: pricing.zone?.id ?? null,
            expectedDeliveryAt,
            customerNote: dto.customerNote,
            idempotencyKey: dto.idempotencyKey,
            items: {
              create: items.map((i) => {
                const priced = pricedByVariant.get(i.variantId)!;
                return {
                  productId: i.variant.product.id,
                  variantId: i.variantId,
                  nameSnapshot: i.variant.product.name,
                  skuSnapshot: i.variant.sku,
                  imageSnapshot: i.variant.product.images[0]?.url ?? null,
                  optionsSnapshot: i.variant.options,
                  unitMrp: priced.mrp,
                  unitPrice: priced.effectiveUnitPrice,
                  qty: i.qty,
                  lineTotal: priced.lineTotal,
                  taxRatePct: priced.taxRatePct,
                };
              }),
            },
            statusHistory: { create: { fromStatus: null, toStatus: 'PENDING_PAYMENT', note: 'Order placed' } },
          },
        });

        for (const i of items) {
          await this.inventory.reserve(tx, i.variantId, i.qty, created.id, i.variant.product.name);
        }
        return created;
      },
      { timeout: 20_000 },
    );

    if (dto.paymentMethod === 'cod') {
      await this.payments.confirmCodOrder(order.id);
      return this.checkoutResponseFor(order.id);
    }

    await this.payments.createPaymentIntent(order.id);
    return this.checkoutResponseFor(order.id);
  }

  /** Uniform response used for both fresh orders and idempotent replays. */
  async checkoutResponseFor(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const payment = order.payments[0];
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      amount: dec(order.total),
      checkout:
        order.status === 'PENDING_PAYMENT' && payment && payment.provider !== 'cod'
          ? {
              provider: payment.provider,
              providerOrderId: payment.providerOrderId,
              amountPaise: Math.round(dec(payment.amount) * 100),
              currency: payment.currency,
              keyId: payment.provider === 'razorpay' ? process.env.RAZORPAY_KEY_ID : undefined,
            }
          : null,
    };
  }
}
