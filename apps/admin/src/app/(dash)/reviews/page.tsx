'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { BadgeCheck, Eye, EyeOff, Star, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Card, EmptyRow, Pagination, Select, Spinner, StatusBadge } from '@/components/ui';

export default function ReviewsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (status) params.set('status', status);
  if (rating) params.set('rating', rating);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', params.toString()],
    queryFn: () => api.get<any>(`/admin/reviews?${params}`),
    placeholderData: keepPreviousData,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-reviews'] });

  const moderate = async (id: string, newStatus: 'APPROVED' | 'HIDDEN') => {
    try {
      await api.patch(`/admin/reviews/${id}/moderate`, { status: newStatus });
      refresh();
      toast('success', newStatus === 'APPROVED' ? 'Review approved' : 'Review hidden');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Moderation failed');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    await api.delete(`/admin/reviews/${id}`);
    refresh();
    toast('info', 'Review deleted');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Reviews</h1>
        <div className="flex gap-2">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className="w-40">
            <option value="">All statuses</option>
            <option value="PENDING">Awaiting moderation</option>
            <option value="APPROVED">Approved</option>
            <option value="HIDDEN">Hidden</option>
          </Select>
          <Select value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} aria-label="Rating" className="w-32">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {data?.items.length === 0 && (
            <Card><p className="p-8 text-center text-sm text-zinc-400">No reviews match this filter.</p></Card>
          )}
          {data?.items.map((r: any) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={clsx('size-4', s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300')} />
                      ))}
                    </span>
                    <StatusBadge status={r.status} />
                    {r.isVerified && (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-600"><BadgeCheck className="size-3.5" /> Verified purchase</span>
                    )}
                  </div>
                  {r.title && <p className="mt-1.5 text-sm font-semibold">{r.title}</p>}
                  {r.body && <p className="mt-1 text-sm text-zinc-500">{r.body}</p>}
                  <p className="mt-2 text-xs text-zinc-400">
                    {r.author} · on <span className="font-medium text-zinc-500">{r.product.name}</span> · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {r.status !== 'APPROVED' && (
                    <button onClick={() => moderate(r.id, 'APPROVED')} title="Approve" className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20">
                      <Eye className="size-4" />
                    </button>
                  )}
                  {r.status !== 'HIDDEN' && (
                    <button onClick={() => moderate(r.id, 'HIDDEN')} title="Hide" className="rounded-lg bg-amber-50 p-2 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20">
                      <EyeOff className="size-4" />
                    </button>
                  )}
                  <button onClick={() => remove(r.id)} title="Delete" className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
          {data && data.total > data.pageSize && (
            <Card><Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} /></Card>
          )}
        </div>
      )}
    </div>
  );
}
