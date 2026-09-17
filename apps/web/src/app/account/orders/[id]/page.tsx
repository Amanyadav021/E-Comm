'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check, CreditCard, MapPin, Package, RotateCcw, Star, Truck, X,
} from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatINR, ORDER_STATUS_LABELS } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Spinner, StatusBadge } from '@/components/ui';

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Want to change address or payment',
  'Other',
];

const RETURN_REASONS = [
  'Item is damaged or defective',
  'Wrong item was delivered',
  'Item does not match description',
  'Size or fit issue',
  'No longer needed',
  'Other',
];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReasonPicker({ reasons, value, onChange }: { reasons: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {reasons.map((r) => (
        <label key={r} className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm has-checked:border-brand-500 has-checked:bg-brand-50/50 dark:border-zinc-700 dark:has-checked:bg-brand-900/20">
          <input type="radio" name="reason" checked={value === r} onChange={() => onChange(r)} className="accent-brand-600" />
          {r}
        </label>
      ))}
    </div>
  );
}

const TIMELINE_STEPS = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<any>(`/orders/${id}`),
  });

  const [modal, setModal] = useState<'cancel' | 'return' | { review: any } | null>(null);
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Spinner />;
  if (!order) return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['order', id] });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const doCancel = async () => {
    if (!reason) return toast('error', 'Please select a reason');
    setBusy(true);
    try {
      await api.post(`/orders/${id}/cancel`, { reason });
      toast('success', 'Order cancelled');
      setModal(null);
      refresh();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Could not cancel the order');
    } finally {
      setBusy(false);
    }
  };

  const doReturn = async () => {
    const items = Object.entries(returnItems)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, qty]) => ({ orderItemId, qty }));
    if (!reason) return toast('error', 'Please select a reason');
    if (items.length === 0) return toast('error', 'Select at least one item to return');
    setBusy(true);
    try {
      await api.post('/orders/returns/request', { orderId: id, reason, comments: comments || undefined, items });
      toast('success', 'Return request submitted');
      setModal(null);
      refresh();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Could not submit the return request');
    } finally {
      setBusy(false);
    }
  };

  const doReview = async (item: any) => {
    setBusy(true);
    try {
      await api.post('/reviews', {
        productId: item.productId,
        rating,
        title: reviewTitle || undefined,
        body: reviewBody || undefined,
      });
      toast('success', 'Thanks for your review!');
      setModal(null);
      refresh();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Could not submit the review');
    } finally {
      setBusy(false);
    }
  };

  const retryPayment = async () => {
    router.push('/checkout');
  };

  const address = order.shippingAddress ?? {};
  const currentStepIndex = TIMELINE_STEPS.indexOf(order.status);
  const isNormalFlow = currentStepIndex >= 0 || order.status === 'PENDING_PAYMENT';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{order.orderNumber}</h1>
        <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} />
      </div>

      {order.canRetryPayment && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
          <CreditCard className="size-5 text-amber-600" />
          <p className="flex-1 text-sm text-amber-700 dark:text-amber-300">
            Payment for this order is pending. Complete it to confirm your order.
          </p>
          <Button size="sm" onClick={retryPayment}>Complete payment</Button>
        </div>
      )}

      {/* Progress timeline */}
      {isNormalFlow && (
        <div className="mb-5 rounded-card border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between">
            {TIMELINE_STEPS.map((step, i) => {
              const done = currentStepIndex >= i;
              const isLast = i === TIMELINE_STEPS.length - 1;
              return (
                <div key={step} className={clsx('flex flex-1 flex-col items-center', !isLast && 'relative')}>
                  {!isLast && (
                    <span
                      className={clsx(
                        'absolute left-1/2 top-3.5 h-0.5 w-full',
                        currentStepIndex > i ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700',
                      )}
                    />
                  )}
                  <span
                    className={clsx(
                      'relative z-10 flex size-7 items-center justify-center rounded-full border-2',
                      done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-zinc-300 bg-white text-zinc-300 dark:border-zinc-600 dark:bg-zinc-900',
                    )}
                  >
                    {done ? <Check className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <span className={clsx('mt-1.5 hidden text-center text-[11px] font-medium sm:block', done ? 'text-emerald-600' : 'text-zinc-400')}>
                    {ORDER_STATUS_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm text-zinc-500 sm:hidden">
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </p>
          {order.trackingNumber && (
            <p className="mt-3 flex items-center justify-center gap-2 text-sm">
              <Truck className="size-4 text-brand-600" />
              {order.courierName ?? 'Courier'}: <strong>{order.trackingNumber}</strong>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Items */}
          <div className="rounded-card border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="border-b border-zinc-100 px-4 py-3 font-bold dark:border-zinc-800">Items</h2>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {order.items.map((item: any) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {item.image ? (
                    <img src={item.image} alt="" className="size-16 rounded-lg object-cover" />
                  ) : (
                    <Package className="size-16 rounded-lg bg-zinc-100 p-4 text-zinc-400 dark:bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{item.name}</p>
                    {Object.keys(item.options ?? {}).length > 0 && (
                      <p className="text-xs text-zinc-400">
                        {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400">Qty {item.qty} · {formatINR(item.unitPrice)}</p>
                    {order.status === 'DELIVERED' && (
                      item.reviewed ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600"><Check className="size-3.5" /> Reviewed</p>
                      ) : (
                        <button
                          onClick={() => {
                            setRating(5);
                            setReviewTitle('');
                            setReviewBody('');
                            setModal({ review: item });
                          }}
                          className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                        >
                          <Star className="size-3.5" /> Rate this product
                        </button>
                      )
                    )}
                  </div>
                  <span className="text-sm font-semibold">{formatINR(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* History */}
          <div className="rounded-card border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="border-b border-zinc-100 px-4 py-3 font-bold dark:border-zinc-800">Order activity</h2>
            <ol className="space-y-0 p-4">
              {[...order.timeline].reverse().map((h: any, i: number) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i !== order.timeline.length - 1 && (
                    <span className="absolute left-[5px] top-4 h-full w-px bg-zinc-200 dark:bg-zinc-700" />
                  )}
                  <span className={clsx('relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full', i === 0 ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-600')} />
                  <div>
                    <p className="text-sm font-medium">{ORDER_STATUS_LABELS[h.to] ?? h.to}</p>
                    {h.note && <p className="text-xs text-zinc-500">{h.note}</p>}
                    <p className="text-xs text-zinc-400">{formatDateTime(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-5">
          {/* Payment summary */}
          <div className="rounded-card border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 font-bold">Payment</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Method</dt><dd className="font-medium uppercase">{order.paymentMethod}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Status</dt><dd><StatusBadge status={order.paymentStatus} /></dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Items</dt><dd>{formatINR(order.subtotal, true)}</dd></div>
              {(order.productDiscount + order.offerDiscount + order.couponDiscount) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Discounts</dt>
                  <dd>− {formatINR(order.productDiscount + order.offerDiscount + order.couponDiscount, true)}</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-zinc-500">Delivery</dt><dd>{order.shippingFee === 0 ? 'FREE' : formatINR(order.shippingFee, true)}</dd></div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold dark:border-zinc-700">
                <dt>Total</dt><dd>{formatINR(order.total, true)}</dd>
              </div>
            </dl>
            {order.refunds?.length > 0 && (
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20">
                {order.refunds.map((r: any) => (
                  <p key={r.id} className="text-emerald-700 dark:text-emerald-300">
                    Refund {formatINR(r.amount, true)} — {r.status === 'COMPLETED' ? 'processed' : r.status.toLowerCase()}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Address */}
          <div className="rounded-card border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><MapPin className="size-4.5 text-brand-600" /> Delivery address</h2>
            <p className="text-sm font-semibold">{address.fullName}</p>
            <p className="text-sm text-zinc-500">
              {address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} — {address.pincode}
            </p>
            <p className="mt-1 text-sm text-zinc-400">Phone: {address.phone}</p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {order.canCancel && (
              <Button variant="outline" className="w-full" onClick={() => { setReason(''); setModal('cancel'); }}>
                <X className="size-4" /> Cancel order
              </Button>
            )}
            {order.canReturn && (
              <Button variant="outline" className="w-full" onClick={() => {
                setReason('');
                setComments('');
                setReturnItems(Object.fromEntries(order.items.map((i: any) => [i.id, i.qty - i.returnedQty])));
                setModal('return');
              }}>
                <RotateCcw className="size-4" /> Request return
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'cancel' && (
        <Modal title="Cancel order" onClose={() => setModal(null)}>
          <ReasonPicker reasons={CANCEL_REASONS} value={reason} onChange={setReason} />
          {order.paymentStatus === 'SUCCESS' && (
            <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              Your payment of {formatINR(order.total, true)} will be refunded automatically (5–7 business days).
            </p>
          )}
          <Button variant="danger" className="mt-4 w-full" loading={busy} onClick={doCancel}>
            Confirm cancellation
          </Button>
        </Modal>
      )}

      {modal === 'return' && (
        <Modal title="Request return" onClose={() => setModal(null)}>
          <p className="mb-2 text-sm font-semibold">Items to return</p>
          <div className="mb-4 space-y-2">
            {order.items.map((item: any) => {
              const max = item.qty - item.returnedQty;
              if (max <= 0) return null;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={(returnItems[item.id] ?? 0) > 0}
                    onChange={(e) => setReturnItems((r) => ({ ...r, [item.id]: e.target.checked ? max : 0 }))}
                    className="accent-brand-600"
                  />
                  <span className="flex-1 truncate text-sm">{item.name}</span>
                  <select
                    value={returnItems[item.id] ?? 0}
                    onChange={(e) => setReturnItems((r) => ({ ...r, [item.id]: Number(e.target.value) }))}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    aria-label={`Return quantity for ${item.name}`}
                  >
                    {Array.from({ length: max + 1 }, (_, n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <p className="mb-2 text-sm font-semibold">Reason</p>
          <ReasonPicker reasons={RETURN_REASONS} value={reason} onChange={setReason} />
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Additional details (optional)"
            rows={2}
            className="mt-3 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <Button className="mt-4 w-full" loading={busy} onClick={doReturn}>
            Submit return request
          </Button>
        </Modal>
      )}

      {modal !== null && typeof modal === 'object' && 'review' in modal && (
        <Modal title="Rate this product" onClose={() => setModal(null)}>
          <p className="mb-3 line-clamp-1 text-sm text-zinc-500">{modal.review.name}</p>
          <div className="mb-4 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)} aria-label={`${s} star${s > 1 ? 's' : ''}`}>
                <Star className={clsx('size-8 transition', s <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 hover:text-amber-300')} />
              </button>
            ))}
          </div>
          <input
            value={reviewTitle}
            onChange={(e) => setReviewTitle(e.target.value)}
            placeholder="Review title (optional)"
            className="mb-2 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <textarea
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            placeholder="Share your experience (optional)"
            rows={3}
            className="w-full rounded-xl border border-zinc-200 p-3.5 text-sm outline-none focus:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <Button className="mt-3 w-full" loading={busy} onClick={() => doReview(modal.review)}>
            Submit review
          </Button>
        </Modal>
      )}
    </div>
  );
}
