'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Package, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { Button, Spinner, StatusBadge } from '@/components/ui';
import { ORDER_STATUS_LABELS } from '@/lib/format';

export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<any>(`/orders/${id}`),
  });

  if (isLoading) return <Spinner />;
  if (!order) return null;

  const address = order.shippingAddress ?? {};

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <div className="fade-up text-center">
        <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="size-11 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {order.paymentMethod === 'cod' ? 'Order placed!' : 'Payment successful!'}
        </h1>
        <p className="mt-2 text-zinc-500">
          Order <span className="font-semibold text-zinc-800 dark:text-zinc-200">{order.orderNumber}</span> is confirmed.
          {order.expectedDeliveryAt && (
            <> Expected delivery by <strong>{formatDate(order.expectedDeliveryAt)}</strong>.</>
          )}
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <span className="text-sm text-zinc-500">Placed {formatDate(order.placedAt)}</span>
          <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} />
        </div>

        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {order.items.map((item: any) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              {item.image ? (
                <img src={item.image} alt="" className="size-14 rounded-lg object-cover" />
              ) : (
                <Package className="size-14 rounded-lg bg-zinc-100 p-3 text-zinc-400 dark:bg-zinc-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-zinc-400">Qty {item.qty}</p>
              </div>
              <span className="text-sm font-semibold">{formatINR(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 border-t border-zinc-100 px-5 py-4 text-sm dark:border-zinc-800">
          <div className="flex justify-between text-zinc-500">
            <span>Payment</span>
            <span className="font-medium uppercase text-zinc-700 dark:text-zinc-300">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>{order.paymentMethod === 'cod' ? 'To pay on delivery' : 'Amount paid'}</span>
            <span>{formatINR(order.total, true)}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 border-t border-zinc-100 px-5 py-4 text-sm dark:border-zinc-800">
          <MapPin className="mt-0.5 size-4.5 shrink-0 text-brand-600" />
          <div>
            <p className="font-semibold">{address.fullName}</p>
            <p className="text-zinc-500">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} — {address.pincode}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={`/account/orders/${order.id}`} className="flex-1">
          <Button variant="outline" size="lg" className="w-full">
            <Truck className="size-5" /> Track order
          </Button>
        </Link>
        <Link href="/products" className="flex-1">
          <Button size="lg" className="w-full">Continue shopping</Button>
        </Link>
      </div>
    </div>
  );
}
