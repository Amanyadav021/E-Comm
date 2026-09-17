import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dec, fromJson } from '../common/utils';
import {
  OfferInput,
  CouponInput,
  PricingLineInput,
  PricingResult,
  priceCart,
  applyOffers,
  ShippingRule,
} from '@shopcraft/shared';

export interface CouponCheck {
  coupon: CouponInput | null;
  error: string | null;
  meta?: { id: string; perUserLimit: number; usageLimit: number | null; usedCount: number; firstOrderOnly: boolean };
}

/**
 * Server-authoritative pricing. Wraps the pure pricing engine from
 * @shopcraft/shared with database access for offers, coupons and shipping.
 * Cart display, checkout and order creation all go through priceLines().
 */
@Injectable()
export class PricingService {
  private offersCache: { offers: OfferInput[]; expires: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getActiveOffers(): Promise<OfferInput[]> {
    const now = Date.now();
    if (this.offersCache && this.offersCache.expires > now) return this.offersCache.offers;

    const rows = await this.prisma.offer.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
      },
      include: { products: true, categories: true },
    });
    const offers: OfferInput[] = rows.map((o) => ({
      id: o.id,
      type: o.type as 'PERCENT' | 'FLAT',
      value: dec(o.value),
      maxDiscount: o.maxDiscount == null ? null : dec(o.maxDiscount),
      appliesTo: o.appliesTo as OfferInput['appliesTo'],
      productIds: o.products.map((p) => p.productId),
      categoryIds: o.categories.map((c) => c.categoryId),
      badgeText: o.badgeText,
      priority: o.priority,
    }));
    this.offersCache = { offers, expires: now + 60_000 };
    return offers;
  }

  invalidateOffersCache() {
    this.offersCache = null;
  }

  /**
   * Load and validate a coupon for a user. Returns a descriptive error string
   * (never throws) so the cart can show why a coupon does not apply.
   */
  async checkCoupon(code: string, userId: string): Promise<CouponCheck> {
    const row = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: { products: true, categories: true },
    });
    if (!row || row.deletedAt || !row.isActive) return { coupon: null, error: 'This coupon code is not valid.' };
    const now = new Date();
    if (row.startsAt && row.startsAt > now) return { coupon: null, error: 'This coupon is not active yet.' };
    if (row.endsAt && row.endsAt < now) return { coupon: null, error: 'This coupon has expired.' };
    if (row.usageLimit != null && row.usedCount >= row.usageLimit) {
      return { coupon: null, error: 'This coupon has been fully redeemed.' };
    }
    const userUses = await this.prisma.couponRedemption.count({ where: { couponId: row.id, userId } });
    if (userUses >= row.perUserLimit) {
      return { coupon: null, error: 'You have already used this coupon.' };
    }
    if (row.firstOrderOnly) {
      const orders = await this.prisma.order.count({
        where: { userId, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'] } },
      });
      if (orders > 0) return { coupon: null, error: 'This coupon is only valid on your first order.' };
    }
    return {
      coupon: {
        id: row.id,
        code: row.code,
        type: row.type as 'PERCENT' | 'FLAT',
        value: dec(row.value),
        minOrderAmount: dec(row.minOrderAmount),
        maxDiscount: row.maxDiscount == null ? null : dec(row.maxDiscount),
        appliesTo: row.appliesTo as CouponInput['appliesTo'],
        productIds: row.products.map((p) => p.productId),
        categoryIds: row.categories.map((c) => c.categoryId),
      },
      error: null,
      meta: {
        id: row.id,
        perUserLimit: row.perUserLimit,
        usageLimit: row.usageLimit,
        usedCount: row.usedCount,
        firstOrderOnly: row.firstOrderOnly,
      },
    };
  }

  /** Resolve the shipping zone for a pincode (exact match, then prefix pattern, then default zone). */
  async resolveShippingZone(pincode?: string | null) {
    if (pincode) {
      const exact = await this.prisma.zonePincode.findFirst({
        where: { pincode, zone: { isActive: true } },
        include: { zone: true },
      });
      if (exact) return exact.zone;
      const prefixes = Array.from({ length: 5 }, (_, i) => pincode.slice(0, i + 1) + '*');
      const pattern = await this.prisma.zonePincode.findFirst({
        where: { pincode: { in: prefixes }, zone: { isActive: true } },
        include: { zone: true },
        orderBy: { pincode: 'desc' }, // longest prefix wins
      });
      if (pattern) return pattern.zone;
    }
    return this.prisma.shippingZone.findFirst({ where: { isDefault: true, isActive: true } });
  }

  shippingRuleFor(zone: { fee: unknown; freeAbove: unknown } | null): ShippingRule {
    if (!zone) return { fee: 0, freeAbove: null };
    return { fee: dec(zone.fee), freeAbove: zone.freeAbove == null ? null : dec(zone.freeAbove) };
  }

  async priceLines(params: {
    lines: PricingLineInput[];
    couponCode?: string | null;
    userId: string;
    pincode?: string | null;
  }): Promise<PricingResult & { zone: Awaited<ReturnType<PricingService['resolveShippingZone']>> }> {
    const offers = await this.getActiveOffers();
    let coupon: CouponInput | null = null;
    let couponError: string | null = null;
    if (params.couponCode) {
      const check = await this.checkCoupon(params.couponCode, params.userId);
      coupon = check.coupon;
      couponError = check.error;
    }
    const zone = await this.resolveShippingZone(params.pincode);
    const result = priceCart({
      lines: params.lines,
      offers,
      coupon,
      shipping: this.shippingRuleFor(zone),
    });
    // a coupon rejected at load time (expired etc.) still surfaces its reason
    if (!result.couponError && couponError) {
      return { ...result, couponCode: params.couponCode ?? null, couponError, zone };
    }
    return { ...result, zone };
  }

  /** Effective (post-offer) price for a single variant — used on listings/PDP. */
  async effectivePrice(line: PricingLineInput) {
    const offers = await this.getActiveOffers();
    const [priced] = applyOffers([line], offers);
    return priced;
  }
}
