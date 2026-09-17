'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronRight, Package } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { formatDate, formatINR, ORDER_STATUS_LABELS } from '@/lib/format';
import { EmptyState, Spinner, StatusBadge, Button } from '@/components/ui';
import type { OrderSummaryRow } from '@/lib/types';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'current', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returns' },
] as const;

export default function OrdersPage() {
  const [filter, setFilter] = useState<(typeof TABS)[number]['value']>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filter, page],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: OrderSummaryRow[] }>(
      `/orders?filter=${filter}&page=${page}`,
    ),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">My orders</h1>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setFilter(t.value);
              setPage(1);
            }}
            className={clsx(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition',
              filter === t.value
                ? 'bg-brand-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={filter === 'all' ? 'No orders yet' : 'Nothing here'}
          text={filter === 'all' ? 'When you place an order, it will show up here.' : 'No orders match this filter.'}
          action={filter === 'all' ? { label: 'Start shopping', href: '/products' } : undefined}
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.id}`}
                className="flex items-center gap-3 rounded-card border border-zinc-200/80 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex -space-x-3">
                  {o.preview.slice(0, 3).map((p, i) =>
                    p.image ? (
                      <img key={i} src={p.image} alt="" className="size-12 rounded-lg border-2 border-white object-cover dark:border-zinc-900" />
                    ) : (
                      <div key={i} className="flex size-12 items-center justify-center rounded-lg border-2 border-white bg-zinc-100 dark:border-zinc-900 dark:bg-zinc-800">
                        <Package className="size-5 text-zinc-400" />
                      </div>
                    ),
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{o.orderNumber}</span>
                    <StatusBadge status={o.status} labels={ORDER_STATUS_LABELS} />
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatDate(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {formatINR(o.total, true)}
                  </p>
                  {o.status === 'DELIVERED' && o.deliveredAt ? (
                    <p className="mt-0.5 text-xs text-emerald-600">Delivered {formatDate(o.deliveredAt)}</p>
                  ) : o.expectedDeliveryAt && !['CANCELLED', 'REFUNDED'].includes(o.status) ? (
                    <p className="mt-0.5 text-xs text-zinc-500">Expected by {formatDate(o.expectedDeliveryAt)}</p>
                  ) : null}
                </div>
                <ChevronRight className="size-5 shrink-0 text-zinc-300" />
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="px-2 text-sm text-zinc-500">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
