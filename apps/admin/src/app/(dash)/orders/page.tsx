'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime, formatINR, ORDER_STATUS_LABELS } from '@/lib/format';
import { Card, EmptyRow, Pagination, SearchInput, Select, Spinner, StatusBadge, Td, Th } from '@/components/ui';
import clsx from 'clsx';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PENDING_PAYMENT', label: 'Awaiting payment' },
];

export default function OrdersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (paymentStatus) params.set('paymentStatus', paymentStatus);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', params.toString()],
    queryFn: () => api.get<any>(`/admin/orders?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Orders</h1>
        <a href="/api/admin/orders/export" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800">
          <Download className="size-4" /> Export CSV
        </a>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatus(t.value); setPage(1); }}
            className={clsx(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              status === t.value
                ? 'bg-brand-600 text-white'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Order #, customer, tracking…" />
        </div>
        <Select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} aria-label="Payment filter" className="w-44">
          <option value="">All payments</option>
          <option value="SUCCESS">Paid</option>
          <option value="PENDING">Payment pending</option>
          <option value="FAILED">Payment failed</option>
          <option value="REFUNDED">Refunded</option>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Items</Th>
                    <Th>Total</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                    <Th>Placed</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {data?.items.length === 0 && <EmptyRow span={7} text="No orders match your filters." />}
                  {data?.items.map((o: any) => (
                    <tr key={o.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td>
                        <Link href={`/orders/${o.id}`} className="font-semibold text-brand-600 hover:underline">
                          {o.orderNumber}
                        </Link>
                      </Td>
                      <Td>
                        <p className="font-medium">{o.customer}</p>
                        <p className="text-xs text-zinc-400">{o.customerContact}</p>
                      </Td>
                      <Td className="text-zinc-500">{o.itemCount}</Td>
                      <Td className="font-semibold">{formatINR(o.total, true)}</Td>
                      <Td>
                        <StatusBadge status={o.paymentStatus} />
                        <p className="mt-0.5 text-[11px] uppercase text-zinc-400">{o.paymentMethod}</p>
                      </Td>
                      <Td><StatusBadge status={o.status} labels={ORDER_STATUS_LABELS} /></Td>
                      <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDateTime(o.placedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
