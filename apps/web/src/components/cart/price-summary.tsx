'use client';

import { formatINR } from '@/lib/format';
import type { CartData } from '@/lib/types';

export function PriceSummary({
  summary,
  couponCode,
}: {
  summary: CartData['summary'];
  couponCode: string | null;
}) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-zinc-500">Price ({summary.itemCount} item{summary.itemCount === 1 ? '' : 's'})</dt>
        <dd>{formatINR(summary.subtotal, true)}</dd>
      </div>
      {summary.productDiscount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <dt>Product discount</dt>
          <dd>− {formatINR(summary.productDiscount, true)}</dd>
        </div>
      )}
      {summary.offerDiscount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <dt>Offer discount</dt>
          <dd>− {formatINR(summary.offerDiscount, true)}</dd>
        </div>
      )}
      {summary.couponDiscount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <dt>Coupon {couponCode ? `(${couponCode})` : ''}</dt>
          <dd>− {formatINR(summary.couponDiscount, true)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-zinc-500">Delivery</dt>
        <dd>{summary.shippingFee === 0 ? <span className="font-semibold text-emerald-600">FREE</span> : formatINR(summary.shippingFee, true)}</dd>
      </div>
      <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-bold dark:border-zinc-700">
        <dt>Total</dt>
        <dd>{formatINR(summary.total, true)}</dd>
      </div>
      <p className="text-xs text-zinc-400">Includes {formatINR(summary.taxAmount, true)} GST</p>
    </dl>
  );
}
