'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/providers';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import clsx from 'clsx';

interface MyReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  createdAt: string;
  product: { name: string; slug: string; image: string | null };
}

export default function MyReviewsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: () => api.get<MyReview[]>('/reviews/mine'),
  });

  if (isLoading) return <Spinner />;

  const remove = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    await api.delete(`/reviews/${id}`);
    qc.invalidateQueries({ queryKey: ['my-reviews'] });
    toast('info', 'Review deleted');
  };

  if (!reviews || reviews.length === 0) {
    return (
      <EmptyState
        icon={<Star />}
        title="No reviews yet"
        text="Rate the products you've purchased from your delivered orders."
        action={{ label: 'View orders', href: '/account/orders' }}
      />
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">My reviews</h1>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-card border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              {r.product.image ? (
                <img src={r.product.image} alt="" className="size-12 rounded-lg object-cover" />
              ) : (
                <div className="size-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/product/${r.product.slug}`} className="line-clamp-1 text-sm font-medium hover:text-brand-600">
                  {r.product.name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={clsx('size-3.5', s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300')} />
                    ))}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              <button onClick={() => remove(r.id)} aria-label="Delete review" className="text-zinc-400 hover:text-rose-600">
                <Trash2 className="size-4.5" />
              </button>
            </div>
            {r.title && <p className="mt-2 text-sm font-semibold">{r.title}</p>}
            {r.body && <p className="mt-1 text-sm text-zinc-500">{r.body}</p>}
            <p className="mt-2 text-xs text-zinc-400">{formatDate(r.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
