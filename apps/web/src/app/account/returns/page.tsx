'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';

interface ReturnRow {
  id: string;
  orderNumber: string;
  orderId: string;
  status: string;
  reason: string;
  adminComment: string | null;
  refundAmount: number | null;
  createdAt: string;
  items: Array<{ name: string; qty: number; image: string | null }>;
}

const RETURN_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved — pickup soon',
  REJECTED: 'Not approved',
  RECEIVED: 'Items received',
  REFUND_PROCESSING: 'Refund processing',
  COMPLETED: 'Completed',
};

export default function ReturnsPage() {
  const { data: returns, isLoading } = useQuery({
    queryKey: ['my-returns'],
    queryFn: () => api.get<ReturnRow[]>('/orders/returns'),
  });

  if (isLoading) return <Spinner />;

  if (!returns || returns.length === 0) {
    return (
      <EmptyState
        icon={<RotateCcw />}
        title="No return requests"
        text="You can request a return from a delivered order's page, within the product's return window."
        action={{ label: 'View orders', href: '/account/orders' }}
      />
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">Returns</h1>
      <div className="space-y-3">
        {returns.map((r) => (
          <div key={r.id} className="rounded-card border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/account/orders/${r.orderId}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Order {r.orderNumber}
              </Link>
              <StatusBadge status={r.status} labels={RETURN_LABELS} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.items.map((item, i) => (
                <span key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs dark:bg-zinc-800">
                  {item.image && <img src={item.image} alt="" className="size-6 rounded object-cover" />}
                  {item.name} × {item.qty}
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-zinc-500">Reason: {r.reason}</p>
            {r.adminComment && <p className="mt-1 text-sm text-zinc-500">Store: {r.adminComment}</p>}
            {r.refundAmount != null && (
              <p className="mt-1 text-sm font-semibold text-emerald-600">Refund: {formatINR(r.refundAmount, true)}</p>
            )}
            <p className="mt-2 text-xs text-zinc-400">Requested {formatDate(r.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
