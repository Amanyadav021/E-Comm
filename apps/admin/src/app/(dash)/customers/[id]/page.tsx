'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Heart, MapPin, Package, ShoppingCart } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, ORDER_STATUS_LABELS } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Card, ConfirmModal, Spinner, StatusBadge } from '@/components/ui';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ['admin-customer', id],
    queryFn: () => api.get<any>(`/admin/customers/${id}`),
  });

  if (isLoading || !c) return <Spinner />;

  const toggleStatus = async () => {
    setBusy(true);
    try {
      await api.patch(`/admin/customers/${id}/status`, {
        status: c.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      });
      qc.invalidateQueries({ queryKey: ['admin-customer', id] });
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
      toast('success', c.status === 'ACTIVE' ? 'Account disabled' : 'Account re-enabled');
      setConfirming(false);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Failed to update account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
          {c.name.charAt(0).toUpperCase()}
        </span>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            {c.name} <StatusBadge status={c.status} />
          </h1>
          <p className="text-sm text-zinc-400">
            {c.email ?? ''} {c.phone ? `· +91 ${c.phone}` : ''} · joined {formatDate(c.createdAt)}
          </p>
        </div>
        <Button
          variant={c.status === 'ACTIVE' ? 'danger' : 'primary'}
          size="sm"
          onClick={() => setConfirming(true)}
        >
          {c.status === 'ACTIVE' ? <><Ban className="size-4" /> Disable account</> : <><CheckCircle2 className="size-4" /> Enable account</>}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><div className="p-4"><p className="text-xs font-semibold uppercase text-zinc-400">Lifetime spend</p><p className="mt-1 text-2xl font-extrabold">{formatINR(c.totalSpent)}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs font-semibold uppercase text-zinc-400">Orders</p><p className="mt-1 text-2xl font-extrabold">{c.orderCount}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs font-semibold uppercase text-zinc-400">Wishlist</p><p className="mt-1 text-2xl font-extrabold">{c.wishlist.length}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs font-semibold uppercase text-zinc-400">Last seen</p><p className="mt-1 text-sm font-bold">{c.lastLoginAt ? formatDateTime(c.lastLoginAt) : 'Never'}</p></div></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={<span className="flex items-center gap-2"><Package className="size-4" /> Recent orders</span>} className="xl:col-span-2">
          <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            {c.recentOrders.length === 0 && <li className="p-6 text-center text-sm text-zinc-400">No orders yet.</li>}
            {c.recentOrders.map((o: any) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                  <div>
                    <p className="text-sm font-semibold text-brand-600">{o.orderNumber}</p>
                    <p className="text-xs text-zinc-400">{formatDateTime(o.placedAt)} · {o.itemCount} items</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatINR(o.total, true)}</p>
                    <StatusBadge status={o.status} labels={ORDER_STATUS_LABELS} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          {c.activeCart && (
            <Card title={<span className="flex items-center gap-2"><ShoppingCart className="size-4" /> Active cart</span>}>
              <ul className="divide-y divide-zinc-50 p-1 text-sm dark:divide-zinc-800/60">
                {c.activeCart.items.map((i: any, idx: number) => (
                  <li key={idx} className="flex justify-between px-3 py-2">
                    <span className="truncate">{i.name} × {i.qty}</span>
                    <span className="font-medium">{formatINR(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-400 dark:border-zinc-800">
                Last activity {formatDateTime(c.activeCart.lastActivityAt)}
              </p>
            </Card>
          )}

          <Card title={<span className="flex items-center gap-2"><MapPin className="size-4" /> Addresses</span>}>
            <div className="space-y-2 p-4 text-sm">
              {c.addresses.length === 0 && <p className="text-zinc-400">None saved.</p>}
              {c.addresses.map((a: any) => (
                <p key={a.id} className="text-zinc-500">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">{a.type}:</span> {a.line1}, {a.city} — {a.pincode}
                </p>
              ))}
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Heart className="size-4" /> Wishlist</span>}>
            <div className="space-y-1.5 p-4 text-sm">
              {c.wishlist.length === 0 && <p className="text-zinc-400">Empty.</p>}
              {c.wishlist.slice(0, 8).map((w: any, i: number) => (
                <p key={i} className="truncate text-zinc-500">{w.name}</p>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          title={c.status === 'ACTIVE' ? 'Disable account' : 'Enable account'}
          text={
            c.status === 'ACTIVE'
              ? `${c.name} will be signed out everywhere and unable to sign in. Order history is preserved.`
              : `${c.name} will be able to sign in and shop again.`
          }
          confirmLabel={c.status === 'ACTIVE' ? 'Disable' : 'Enable'}
          danger={c.status === 'ACTIVE'}
          busy={busy}
          onConfirm={toggleStatus}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
