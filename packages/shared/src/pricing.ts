// Server-authoritative pricing engine.
// Pure functions — no I/O — so cart, checkout, and order creation all price
// through the exact same code path, and it is fully unit-testable.
//
// Conventions:
// - All amounts are INR rupees with 2-decimal precision (round2 everywhere).
// - Product prices are GST-INCLUSIVE (standard for Indian retail). taxAmount
//   is derived out of the inclusive total for the invoice breakdown.

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface PricingLineInput {
  variantId: string;
  productId: string;
  categoryId: string;
  qty: number;
  mrp: number;
  price: number; // variant selling price (before offers/coupons)
  taxRatePct: number;
}

export interface OfferInput {
  id: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  maxDiscount?: number | null;
  appliesTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
  productIds?: string[];
  categoryIds?: string[];
  badgeText?: string | null;
  priority: number;
}

export interface CouponInput {
  id: string;
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  appliesTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
  productIds?: string[];
  categoryIds?: string[];
}

export interface PricedLine extends PricingLineInput {
  /** unit price after best offer, before coupon */
  effectiveUnitPrice: number;
  offerId: string | null;
  offerBadge: string | null;
  unitOfferDiscount: number;
  lineMrpTotal: number;
  lineProductDiscount: number; // (mrp - price) * qty
  lineOfferDiscount: number;
  lineTotal: number; // effectiveUnitPrice * qty
}

export interface PricingResult {
  lines: PricedLine[];
  subtotal: number; // sum of MRP * qty
  productDiscount: number;
  offerDiscount: number;
  couponDiscount: number;
  couponCode: string | null;
  couponError: string | null;
  itemsTotal: number; // subtotal - all discounts (before shipping)
  shippingFee: number;
  taxAmount: number; // informational — extracted from inclusive prices
  total: number; // final payable
}

function offerMatchesLine(offer: OfferInput, line: PricingLineInput): boolean {
  if (offer.appliesTo === 'ALL') return true;
  if (offer.appliesTo === 'PRODUCT') return !!offer.productIds?.includes(line.productId);
  if (offer.appliesTo === 'CATEGORY') return !!offer.categoryIds?.includes(line.categoryId);
  return false;
}

function couponMatchesLine(coupon: CouponInput, line: PricingLineInput): boolean {
  if (coupon.appliesTo === 'ALL') return true;
  if (coupon.appliesTo === 'PRODUCT') return !!coupon.productIds?.includes(line.productId);
  if (coupon.appliesTo === 'CATEGORY') return !!coupon.categoryIds?.includes(line.categoryId);
  return false;
}

function computeUnitOfferDiscount(offer: OfferInput, unitPrice: number): number {
  let d = offer.type === 'PERCENT' ? (unitPrice * offer.value) / 100 : offer.value;
  if (offer.maxDiscount != null) d = Math.min(d, offer.maxDiscount);
  return round2(Math.max(0, Math.min(d, unitPrice)));
}

/** Pick the best (largest discount; priority breaks ties) applicable offer per line. */
export function applyOffers(lines: PricingLineInput[], offers: OfferInput[]): PricedLine[] {
  return lines.map((line) => {
    let best: { offer: OfferInput; discount: number } | null = null;
    for (const offer of offers) {
      if (!offerMatchesLine(offer, line)) continue;
      const discount = computeUnitOfferDiscount(offer, line.price);
      if (discount <= 0) continue;
      if (
        !best ||
        discount > best.discount ||
        (discount === best.discount && offer.priority > best.offer.priority)
      ) {
        best = { offer, discount };
      }
    }
    const unitOfferDiscount = best?.discount ?? 0;
    const effectiveUnitPrice = round2(line.price - unitOfferDiscount);
    return {
      ...line,
      effectiveUnitPrice,
      offerId: best?.offer.id ?? null,
      offerBadge: best?.offer.badgeText ?? null,
      unitOfferDiscount,
      lineMrpTotal: round2(line.mrp * line.qty),
      lineProductDiscount: round2((line.mrp - line.price) * line.qty),
      lineOfferDiscount: round2(unitOfferDiscount * line.qty),
      lineTotal: round2(effectiveUnitPrice * line.qty),
    };
  });
}

export function computeCouponDiscount(
  coupon: CouponInput,
  pricedLines: PricedLine[],
): { discount: number; error: string | null } {
  const eligibleTotal = round2(
    pricedLines.filter((l) => couponMatchesLine(coupon, l)).reduce((s, l) => s + l.lineTotal, 0),
  );
  if (eligibleTotal <= 0) {
    return { discount: 0, error: 'Coupon is not applicable to items in your cart' };
  }
  const cartTotal = round2(pricedLines.reduce((s, l) => s + l.lineTotal, 0));
  if (cartTotal < coupon.minOrderAmount) {
    return {
      discount: 0,
      error: `Add items worth ₹${round2(coupon.minOrderAmount - cartTotal)} more to use this coupon`,
    };
  }
  let discount =
    coupon.type === 'PERCENT' ? (eligibleTotal * coupon.value) / 100 : Math.min(coupon.value, eligibleTotal);
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  return { discount: round2(Math.max(0, discount)), error: null };
}

export interface ShippingRule {
  fee: number;
  freeAbove?: number | null;
}

export function computeShipping(itemsTotal: number, rule: ShippingRule): number {
  if (rule.freeAbove != null && itemsTotal >= rule.freeAbove) return 0;
  return round2(rule.fee);
}

/** GST included in price: tax = inclusive * rate / (100 + rate) */
export function extractInclusiveTax(lines: PricedLine[], couponDiscount: number): number {
  const itemsTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  if (itemsTotal <= 0) return 0;
  let tax = 0;
  for (const line of lines) {
    // distribute coupon discount proportionally for tax purposes
    const share = itemsTotal > 0 ? line.lineTotal / itemsTotal : 0;
    const lineNet = line.lineTotal - couponDiscount * share;
    tax += (lineNet * line.taxRatePct) / (100 + line.taxRatePct);
  }
  return round2(tax);
}

export function priceCart(params: {
  lines: PricingLineInput[];
  offers: OfferInput[];
  coupon?: CouponInput | null;
  shipping: ShippingRule;
}): PricingResult {
  const pricedLines = applyOffers(params.lines, params.offers);
  const subtotal = round2(pricedLines.reduce((s, l) => s + l.lineMrpTotal, 0));
  const productDiscount = round2(pricedLines.reduce((s, l) => s + l.lineProductDiscount, 0));
  const offerDiscount = round2(pricedLines.reduce((s, l) => s + l.lineOfferDiscount, 0));
  const itemsTotalBeforeCoupon = round2(pricedLines.reduce((s, l) => s + l.lineTotal, 0));

  let couponDiscount = 0;
  let couponError: string | null = null;
  let couponCode: string | null = null;
  if (params.coupon) {
    couponCode = params.coupon.code;
    const res = computeCouponDiscount(params.coupon, pricedLines);
    couponDiscount = res.discount;
    couponError = res.error;
  }

  const itemsTotal = round2(itemsTotalBeforeCoupon - couponDiscount);
  const shippingFee = computeShipping(itemsTotal, params.shipping);
  const taxAmount = extractInclusiveTax(pricedLines, couponDiscount);
  const total = round2(itemsTotal + shippingFee);

  return {
    lines: pricedLines,
    subtotal,
    productDiscount,
    offerDiscount,
    couponDiscount,
    couponCode,
    couponError,
    itemsTotal,
    shippingFee,
    taxAmount,
    total,
  };
}

export function discountPct(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
