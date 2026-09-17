'use client';

import { Heart, ShoppingCart, Trash2, TrendingDown } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { formatINR } from '@/lib/format';
import { EmptyState, Spinner, Button } from '@/components/ui';
import Link from 'next/link';

export default function WishlistPage() {
  const { items, isLoading, toggle, moveToCart } = useWishlist();

  if (isLoading) return <Spinner />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Heart />}
        title="Your wishlist is empty"
        text="Tap the heart on any product to save it here for later."
        action={{ label: 'Discover products', href: '/products' }}
      />
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">
        Wishlist <span className="text-base font-normal text-zinc-400">({items.length})</span>
      </h1>
      <div className="space-y-3">
        {items.map((p) => (
          <div key={p.id} className="flex gap-3 rounded-card border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <Link href={`/product/${p.slug}`} className="shrink-0">
              {p.image ? (
                <img src={p.image} alt="" className="size-24 rounded-xl object-cover" />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-xl bg-zinc-100 text-3xl dark:bg-zinc-800">🛍️</div>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              {p.brand && <p className="text-xs uppercase tracking-wide text-zinc-400">{p.brand}</p>}
              <Link href={`/product/${p.slug}`} className="line-clamp-1 text-sm font-medium hover:text-brand-600">
                {p.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="font-bold">{formatINR(p.price)}</span>
                {p.mrp > p.price && <span className="text-xs text-zinc-400 line-through">{formatINR(p.mrp)}</span>}
                {p.priceDropped && p.priceAtAdd != null && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                    <TrendingDown className="size-3.5" /> Price dropped from {formatINR(p.priceAtAdd)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs">
                {p.inStock ? (
                  <span className="text-emerald-600">In stock</span>
                ) : (
                  <span className="text-rose-600">Out of stock</span>
                )}
              </p>
              <div className="mt-auto flex gap-2 pt-2">
                <Button
                  size="sm"
                  disabled={!p.inStock}
                  loading={moveToCart.isPending}
                  onClick={() => moveToCart.mutate(p.id)}
                >
                  <ShoppingCart className="size-3.5" /> Move to cart
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate(p.id)}>
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
