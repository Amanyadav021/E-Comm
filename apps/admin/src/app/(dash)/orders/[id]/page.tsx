'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, MapPin, Package, StickyNote, User2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatINR, ORDER_STATUS_LABELS } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Card, Input, Modal, Select, Spinner, StatusBadge, Textarea } from '@/components/ui';

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useToast();

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => api.get<any>(`/admin/orders/${id}`),
  });

  const [statusModal, setStatusModal] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading || !order) return <Spinner />;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-order', id] });
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const updateStatus = async () => {
    if (!statusModal) return;
    setBusy(true);
    try {
      await api.patch(`/admin/orders/${id}/status`, {
        status: statusModal,
        note: note || undefined,
        trackingNumber: tracking || undefined,
        courierName: courier || undefined,
      });
      toast('success', `Order moved to ${ORDER_STATUS_LABELS[statusModal] ?? statusModal}`);
      setStatusModal(null);
      setNote('');
      refresh();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Status update failed');
    } finally {
      setBusy(false);
    }
  };

  const issueRefund = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/orders/${id}/refund`, {
        amount: Number(refundAmount),
        reason: refundReason || undefined,
      });
      toast('success', 'Refund initiated');
      setRefundModal(false);
      refresh();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Refund failed');
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (adminNote === null) return;
    await api.patch(`/admin/orders/${id}/note`, { note: adminNote });
    toast('success', 'Note saved');
    setAdminNote(null);
    refresh();
  };

  const a = order.amounts;
  const refundable = order.payments.some((p: any) => ['SUCCESS', 'PARTIALLY_REFUNDED'].includes(p.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{order.orderNumber}</h1>
        <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} />
        <StatusBadge status={order.paymentStatus} />
        <div className="ml-auto flex flex-wrap gap-2">
          {order.allowedTransitions.map((t: string) => (
            <Button
              key={t}
              size="sm"
              variant={t === 'CANCELLED' ? 'danger' : 'primary'}
              onClick={() => {
                setStatusModal(t);
                setTracking(order.trackingNumber ?? '');
                setCourier(order.courierName ?? '');
              }}
            >
              → {ORDER_STATUS_LABELS[t] ?? t}
            </Button>
          ))}
          {refundable && (
            <Button size="sm" variant="outline" onClick={() => { setRefundAmount(String(a.total)); setRefundModal(true); }}>
              Issue refund
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Items */}
          <Card title={<span className="flex items-center gap-2"><Package className="size-4" /> Items</span>}>
            <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {order.items.map((item: any) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {item.image ? (
                    <img src={item.image} alt="" className="size-12 rounded-lg object-cover" />
                  ) : (
                    <div className="size-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-zinc-400">
                      {item.sku}
                      {Object.keys(item.options ?? {}).length > 0 &&
                        ' · ' + Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      {item.returnedQty > 0 && ` · ${item.returnedQty} returned`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatINR(item.lineTotal, true)}</p>
                    <p className="text-xs text-zinc-400">{item.qty} × {formatINR(item.unitPrice, true)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-zinc-100 px-4 py-3 text-sm dark:border-zinc-800">
              <div className="flex justify-between text-zinc-500"><dt>Subtotal (MRP)</dt><dd>{formatINR(a.subtotal, true)}</dd></div>
              {a.productDiscount > 0 && <div className="flex justify-between text-emerald-600"><dt>Product discount</dt><dd>− {formatINR(a.productDiscount, true)}</dd></div>}
              {a.offerDiscount > 0 && <div className="flex justify-between text-emerald-600"><dt>Offer discount</dt><dd>− {formatINR(a.offerDiscount, true)}</dd></div>}
              {a.couponDiscount > 0 && <div className="flex justify-between text-emerald-600"><dt>Coupon {a.couponCode ? `(${a.couponCode})` : ''}</dt><dd>− {formatINR(a.couponDiscount, true)}</dd></div>}
              <div className="flex justify-between text-zinc-500"><dt>Shipping</dt><dd>{formatINR(a.shippingFee, true)}</dd></div>
              <div className="flex justify-between text-zinc-500"><dt>GST (included)</dt><dd>{formatINR(a.taxAmount, true)}</dd></div>
              <div className="flex justify-between border-t border-zinc-100 pt-2 text-base font-bold dark:border-zinc-800"><dt>Total</dt><dd>{formatINR(a.total, true)}</dd></div>
            </dl>
          </Card>

          {/* Timeline */}
          <Card title="Timeline">
            <ol className="p-4">
              {[...order.timeline].reverse().map((h: any, i: number) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i !== order.timeline.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-zinc-200 dark:bg-zinc-700" />}
                  <span className={`relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ${i === 0 ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{ORDER_STATUS_LABELS[h.to] ?? h.to}</p>
                    {h.note && <p className="text-xs text-zinc-500">{h.note}</p>}
                    <p className="text-xs text-zinc-400">{formatDateTime(h.at)} · {h.by}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {/* Payments & refunds */}
          <Card title={<span className="flex items-center gap-2"><CreditCard className="size-4" /> Payments &amp; refunds</span>}>
            <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {order.payments.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{p.provider.toUpperCase()} {p.method ? `· ${p.method.toUpperCase()}` : ''}</p>
                    <p className="text-xs text-zinc-400">
                      {p.providerPaymentId ?? p.providerOrderId ?? '—'} · {formatDateTime(p.createdAt)}
                      {p.verifiedAt && ' · verified'}
                    </p>
                    {p.errorReason && <p className="text-xs text-rose-500">{p.errorReason}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatINR(p.amount, true)}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
              {order.refunds.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between gap-3 bg-emerald-50/40 px-4 py-3 text-sm dark:bg-emerald-900/10">
                  <div>
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">Refund</p>
                    <p className="text-xs text-zinc-400">{r.reason ?? '—'} · {formatDateTime(r.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">− {formatINR(r.amount, true)}</p>
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <Card title={<span className="flex items-center gap-2"><User2 className="size-4" /> Customer</span>}>
            <div className="p-4 text-sm">
              <Link href={`/customers/${order.customer.id}`} className="font-semibold text-brand-600 hover:underline">
                {order.customer.name}
              </Link>
              <p className="text-zinc-500">{order.customer.email ?? order.customer.phone}</p>
              <p className="mt-1 text-xs text-zinc-400">{order.customer.orderCount} lifetime order{order.customer.orderCount === 1 ? '' : 's'}</p>
            </div>
          </Card>

          {/* Address */}
          <Card title={<span className="flex items-center gap-2"><MapPin className="size-4" /> Shipping address</span>}>
            <div className="p-4 text-sm">
              <p className="font-semibold">{order.shippingAddress.fullName}</p>
              <p className="text-zinc-500">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
                {order.shippingAddress.state} — {order.shippingAddress.pincode}
              </p>
              <p className="mt-1 text-zinc-400">Phone: {order.shippingAddress.phone}</p>
              {order.trackingNumber && (
                <p className="mt-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs dark:bg-zinc-800">
                  {order.courierName ?? 'Courier'}: <strong>{order.trackingNumber}</strong>
                </p>
              )}
              {order.customerNote && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  Customer note: {order.customerNote}
                </p>
              )}
            </div>
          </Card>

          {/* Internal notes */}
          <Card
            title={<span className="flex items-center gap-2"><StickyNote className="size-4" /> Internal notes</span>}
            actions={
              adminNote === null ? (
                <button onClick={() => setAdminNote(order.adminNote ?? '')} className="text-xs font-semibold text-brand-600">Edit</button>
              ) : (
                <button onClick={saveNote} className="text-xs font-semibold text-emerald-600">Save</button>
              )
            }
          >
            <div className="p-4">
              {adminNote === null ? (
                <p className="whitespace-pre-line text-sm text-zinc-500">{order.adminNote || 'No notes yet.'}</p>
              ) : (
                <Textarea rows={4} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Visible only to staff" />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Status modal */}
      {statusModal && (
        <Modal title={`Move to: ${ORDER_STATUS_LABELS[statusModal] ?? statusModal}`} onClose={() => setStatusModal(null)}>
          {statusModal === 'SHIPPED' && (
            <div className="mb-3 space-y-3">
              <Input label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              <Input label="Courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Delhivery, Blue Dart" />
            </div>
          )}
          <Textarea
            label={statusModal === 'CANCELLED' ? 'Cancellation reason (shared with customer)' : 'Note (optional)'}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {statusModal === 'CANCELLED' && order.paymentStatus === 'SUCCESS' && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              The captured payment will be auto-refunded in full.
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStatusModal(null)}>Cancel</Button>
            <Button variant={statusModal === 'CANCELLED' ? 'danger' : 'primary'} loading={busy} onClick={updateStatus}>
              Confirm
            </Button>
          </div>
        </Modal>
      )}

      {/* Refund modal */}
      {refundModal && (
        <Modal title="Issue refund" onClose={() => setRefundModal(false)}>
          <div className="space-y-3">
            <Input label="Amount (₹)" type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} hint={`Order total: ${formatINR(a.total, true)}. Partial refunds are supported.`} />
            <Input label="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Why is this refund being issued?" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRefundModal(false)}>Cancel</Button>
            <Button loading={busy} onClick={issueRefund} disabled={!refundAmount || Number(refundAmount) <= 0}>
              Refund {refundAmount ? formatINR(Number(refundAmount), true) : ''}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
