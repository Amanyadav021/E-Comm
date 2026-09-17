import {
  priceCart,
  applyOffers,
  computeCouponDiscount,
  computeShipping,
  discountPct,
  round2,
  type PricingLineInput,
  type OfferInput,
  type CouponInput,
} from '@shopcraft/shared';

const line = (over: Partial<PricingLineInput> = {}): PricingLineInput => ({
  variantId: 'v1',
  productId: 'p1',
  categoryId: 'c1',
  qty: 1,
  mrp: 1000,
  price: 800,
  taxRatePct: 18,
  ...over,
});

const percentOffer = (over: Partial<OfferInput> = {}): OfferInput => ({
  id: 'o1',
  type: 'PERCENT',
  value: 10,
  appliesTo: 'ALL',
  priority: 0,
  ...over,
});

describe('offer application', () => {
  it('applies a percent offer to the unit price', () => {
    const [priced] = applyOffers([line()], [percentOffer()]);
    expect(priced.effectiveUnitPrice).toBe(720); // 800 - 10%
    expect(priced.unitOfferDiscount).toBe(80);
  });

  it('caps a percent offer at maxDiscount', () => {
    const [priced] = applyOffers([line({ price: 36999, mrp: 42999 })], [percentOffer({ maxDiscount: 3000 })]);
    expect(priced.effectiveUnitPrice).toBe(33999);
  });

  it('never makes the price negative with a large flat offer', () => {
    const [priced] = applyOffers([line({ price: 100 })], [percentOffer({ type: 'FLAT', value: 500 })]);
    expect(priced.effectiveUnitPrice).toBe(0);
  });

  it('picks the biggest applicable discount among several offers', () => {
    const [priced] = applyOffers(
      [line()],
      [percentOffer({ id: 'small', value: 5 }), percentOffer({ id: 'big', value: 15 })],
    );
    expect(priced.offerId).toBe('big');
    expect(priced.effectiveUnitPrice).toBe(680);
  });

  it('uses priority to break exact ties', () => {
    const [priced] = applyOffers(
      [line()],
      [percentOffer({ id: 'lo', value: 10, priority: 1 }), percentOffer({ id: 'hi', value: 10, priority: 5 })],
    );
    expect(priced.offerId).toBe('hi');
  });

  it('respects category scoping', () => {
    const offers = [percentOffer({ appliesTo: 'CATEGORY', categoryIds: ['electronics'] })];
    const [inScope] = applyOffers([line({ categoryId: 'electronics' })], offers);
    const [outScope] = applyOffers([line({ categoryId: 'fashion' })], offers);
    expect(inScope.unitOfferDiscount).toBe(80);
    expect(outScope.unitOfferDiscount).toBe(0);
  });

  it('respects product scoping', () => {
    const offers = [percentOffer({ appliesTo: 'PRODUCT', productIds: ['p42'] })];
    const [inScope] = applyOffers([line({ productId: 'p42' })], offers);
    const [outScope] = applyOffers([line({ productId: 'p1' })], offers);
    expect(inScope.unitOfferDiscount).toBe(80);
    expect(outScope.unitOfferDiscount).toBe(0);
  });
});

describe('coupon computation', () => {
  const coupon = (over: Partial<CouponInput> = {}): CouponInput => ({
    id: 'c1',
    code: 'TEST',
    type: 'PERCENT',
    value: 10,
    minOrderAmount: 0,
    appliesTo: 'ALL',
    ...over,
  });

  const pricedLines = (l: PricingLineInput[] = [line({ qty: 2 })]) => applyOffers(l, []);

  it('computes a percent coupon on eligible totals', () => {
    const { discount, error } = computeCouponDiscount(coupon(), pricedLines());
    expect(error).toBeNull();
    expect(discount).toBe(160); // 10% of 1600
  });

  it('enforces minimum order amount with a helpful message', () => {
    const { discount, error } = computeCouponDiscount(coupon({ minOrderAmount: 5000 }), pricedLines());
    expect(discount).toBe(0);
    expect(error).toContain('more to use this coupon');
  });

  it('caps at maxDiscount', () => {
    const { discount } = computeCouponDiscount(coupon({ value: 50, maxDiscount: 200 }), pricedLines());
    expect(discount).toBe(200);
  });

  it('flat coupon never exceeds the eligible total', () => {
    const { discount } = computeCouponDiscount(
      coupon({ type: 'FLAT', value: 99999 }),
      pricedLines([line({ qty: 1 })]),
    );
    expect(discount).toBe(800);
  });

  it('scoped coupon ignores non-matching lines', () => {
    const lines = pricedLines([
      line({ variantId: 'a', productId: 'eligible', qty: 1 }),
      line({ variantId: 'b', productId: 'other', qty: 1 }),
    ]);
    const { discount } = computeCouponDiscount(
      coupon({ appliesTo: 'PRODUCT', productIds: ['eligible'] }),
      lines,
    );
    expect(discount).toBe(80); // 10% of only the eligible 800
  });
});

describe('shipping & totals', () => {
  it('waives the fee above the free-shipping threshold', () => {
    expect(computeShipping(1200, { fee: 70, freeAbove: 999 })).toBe(0);
    expect(computeShipping(500, { fee: 70, freeAbove: 999 })).toBe(70);
    expect(computeShipping(500, { fee: 70, freeAbove: null })).toBe(70);
  });

  it('produces a consistent full breakdown', () => {
    const result = priceCart({
      lines: [line({ qty: 2 })], // mrp 2000, price 1600
      offers: [percentOffer()], // -160
      coupon: { id: 'c', code: 'FLAT100', type: 'FLAT', value: 100, minOrderAmount: 0, appliesTo: 'ALL' },
      shipping: { fee: 70, freeAbove: 999 },
    });
    expect(result.subtotal).toBe(2000);
    expect(result.productDiscount).toBe(400);
    expect(result.offerDiscount).toBe(160);
    expect(result.couponDiscount).toBe(100);
    expect(result.itemsTotal).toBe(1340);
    expect(result.shippingFee).toBe(0); // above 999
    expect(result.total).toBe(1340);
    // GST extracted from the inclusive amount, never added on top
    expect(result.taxAmount).toBeCloseTo(round2((1340 * 18) / 118), 1);
  });

  it('reports coupon errors without corrupting totals', () => {
    const result = priceCart({
      lines: [line()],
      offers: [],
      coupon: { id: 'c', code: 'BIG', type: 'PERCENT', value: 10, minOrderAmount: 99999, appliesTo: 'ALL' },
      shipping: { fee: 0 },
    });
    expect(result.couponError).toBeTruthy();
    expect(result.couponDiscount).toBe(0);
    expect(result.total).toBe(800);
  });
});

describe('discount percentage display', () => {
  it('computes and clamps sensibly', () => {
    expect(discountPct(1000, 800)).toBe(20);
    expect(discountPct(1000, 1000)).toBe(0);
    expect(discountPct(0, 100)).toBe(0);
    expect(discountPct(100, 150)).toBe(0);
  });
});
