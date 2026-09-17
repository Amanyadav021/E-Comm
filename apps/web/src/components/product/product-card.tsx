'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import clsx from 'clsx';
import { formatINR } from '@/lib/format';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import type { ProductCard as ProductCardType } from '@/lib/types';

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  if (!count && !value) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={clsx(
          'inline-flex items-center gap-0.5 rounded-md bg-emerald-600 font-semibold text-white',
          size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-sm',
        )}
      >
        {value.toFixed(1)}
        <Star className={size === 'sm' ? 'size-2.5 fill-current' : 'size-3.5 fill-current'} />
      </span>
      {count != null && <span className="text-xs text-zinc-400">({count})</span>}
    </span>
  );
}

export function WishlistHeart({ productId, className }: { productId: string; className?: string }) {
  const { has, toggle, isAuthed } = useWishlist();
  const router = useRouter();
  const active = has(productId);
  return (
    <button
      aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthed) {
          router.push('/login');
          return;
        }
        toggle.mutate(productId);
      }}
      className={clsx(
        'flex size-8 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-zinc-900/5 transition hover:scale-105 dark:bg-zinc-800/95 dark:ring-white/10',
        className,
      )}
    >
      <Heart className={clsx('size-4.5 transition', active ? 'fill-rose-500 text-rose-500' : 'text-zinc-500 dark:text-zinc-300')} />
    </button>
  );
}

export function ProductCardView({ product, priority = false }: { product: ProductCardType; priority?: boolean }) {
  const { add } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-zinc-200/80 bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-900/8 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-4xl">🛍️</div>
        )}
        {product.discountPct > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-deal-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {product.discountPct}% off
          </span>
        )}
        {product.offerBadge && (
          <span className="absolute left-2 top-9 rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {product.offerBadge}
          </span>
        )}
        <WishlistHeart productId={product.id} className="absolute right-2 top-2" />
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-zinc-900/70">
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand && <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{product.brand}</p>}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</h3>
        <Rating value={product.ratingAvg} count={product.ratingCount} />
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold">{formatINR(product.price)}</span>
          {product.mrp > product.price && (
            <span className="text-xs text-zinc-400 line-through">{formatINR(product.mrp)}</span>
          )}
        </div>
        {product.inStock && product.defaultVariantId && (
          <button
            onClick={(e) => {
              e.preventDefault();
              if (!user) {
                router.push('/login');
                return;
              }
              add.mutate({ variantId: product.defaultVariantId! });
            }}
            disabled={add.isPending}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 py-1.5 text-xs font-semibold text-brand-700 opacity-0 transition hover:bg-brand-100 group-hover:opacity-100 disabled:opacity-50 max-md:opacity-100 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
          >
            <ShoppingCart className="size-3.5" />
            Add to cart
          </button>
        )}
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-zinc-200/80 dark:border-zinc-800">
      <div className="skeleton aspect-square" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
    </div>
  );
}
