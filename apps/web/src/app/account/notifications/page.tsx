'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Package, Tag, CreditCard, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Button, EmptyState, Spinner } from '@/components/ui';
import clsx from 'clsx';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: string | null;
  readAt: string | null;
  createdAt: string;
}

function iconFor(type: string) {
  if (type.startsWith('ORDER')) return Package;
  if (type.startsWith('PAYMENT')) return CreditCard;
  if (type.startsWith('RETURN') || type.startsWith('REFUND')) return RotateCcw;
  if (['PROMO', 'PRICE_DROP', 'COUPON'].some((t) => type.includes(t))) return Tag;
  return Bell;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ total: number; unread: number; items: NotificationRow[] }>('/me/notifications'),
  });

  if (isLoading) return <Spinner />;

  const items = data?.items ?? [];

  const markAll = async () => {
    await api.post('/me/notifications/read-all');
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const open = async (n: NotificationRow) => {
    if (!n.readAt) {
      await api.post(`/me/notifications/${n.id}/read`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Notifications{' '}
          {data && data.unread > 0 && (
            <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{data.unread} new</span>
          )}
        </h1>
        {data && data.unread > 0 && (
          <Button size="sm" variant="ghost" onClick={markAll}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="No notifications yet"
          text="Order updates, offers and price drops will appear here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            let orderId: string | null = null;
            try {
              orderId = n.data ? (JSON.parse(n.data).orderId ?? null) : null;
            } catch { /* ignore */ }
            const inner = (
              <div
                onClick={() => open(n)}
                className={clsx(
                  'flex cursor-pointer gap-3 rounded-card border p-4 transition hover:border-brand-200',
                  n.readAt
                    ? 'border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                    : 'border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-900/10',
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm', !n.readAt && 'font-semibold')}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-zinc-500">{n.body}</p>}
                  <p className="mt-1 text-xs text-zinc-400">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-600" />}
              </div>
            );
            return orderId ? (
              <Link key={n.id} href={`/account/orders/${orderId}`}>{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
