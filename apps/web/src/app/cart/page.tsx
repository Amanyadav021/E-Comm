'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Minus, Plus, ShoppingCart, Tag, Trash2, X, AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { PriceSummary } from '@/components/cart/price-summary';

function CouponBox() {
  const { cart, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState('');

  if (cart?.couponCode) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-900/20">
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <Tag className="size-4" /> {cart.couponCode} applied
        </span>
        <button onClick={() => removeCoupon.mutate()} aria-label="Remove coupon" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) applyCoupon.mutate(code.trim(), { onSuccess: () => setCode('') });
      }}
      className="flex gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Enter coupon code"
        aria-label="Coupon code"
        className="min-w-0 flex-1 rounded-xl border border-dashed border-zinc-300 px-3.5 py-2.5 text-sm uppercase outline-none focus:border-brand-400 dark:border-zinc-600 dark:bg-zinc-900"
      />
      <Button type="submit" variant="outline" size="md" loading={applyCoupon.isPending} disabled={!code.trim()}>
        Apply
      </Button>
    </form>
  );
}

export default function CartPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { cart, isLoading, update, remove } = useCart();

  if (authLoading || (user && isLoading)) return <Spinner />;

  if (!user) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Sign in to see your cart"
        text="Your cart is saved to your account so you can pick up where you left off, on any device."
        action={{ label: 'Sign in', href: '/login?next=/cart' }}
      />
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Your cart is empty"
        text="Looks like you haven't added anything yet. Explore today's deals to get started."
        action={{ label: 'Start shopping', href: '/products' }}
      />
    );
  }

  const hasStockIssue = cart.items.some((i) => !i.inStock || i.insufficientStock);
  const freeShipGap =
    cart.summary.freeShippingAbove != null && cart.summary.shippingFee > 0
      ? cart.summary.freeShippingAbove - (cart.summary.total - cart.summary.shippingFee)
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:py-8">
      <h1 className="mb-4 text-xl font-bold md:text-2xl">
        My Cart <span className="text-base font-normal text-zinc-400">({cart.summary.itemCount})</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {freeShipGap != null && freeShipGap > 0 && (
            <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
              Add {formatINR(freeShipGap)} more to get <strong>FREE delivery</strong>
            </p>
          )}
          {cart.couponError && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" /> {cart.couponError}
            </p>
          )}

          {cart.items.map((item) => (
            <div
              key={item.id}
              className="flex gap-3 rounded-card border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link href={`/product/${item.slug}`} className="shrink-0">
                {item.image ? (
                  <img src={item.image} alt="" className="size-24 rounded-xl object-cover" />
                ) : (
                  <div className="flex size-24 items-center justify-center rounded-xl bg-zinc-100 text-3xl dark:bg-zinc-800">🛍️</div>
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium hover:text-brand-600">
                  {item.name}
                </Link>
                {Object.keys(item.options).length > 0 && (
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-bold">{formatINR(item.price)}</span>
                  {item.mrp > item.price && <span className="text-xs text-zinc-400 line-through">{formatINR(item.mrp)}</span>}
                  {item.offerBadge && <span className="text-xs font-semibold text-brand-600">{item.offerBadge}</span>}
                </div>
                {!item.inStock ? (
                  <p className="mt-1 text-xs font-semibold text-rose-600">Out of stock — remove to continue</p>
                ) : item.insufficientStock ? (
                  <p className="mt-1 text-xs font-semibold text-amber-600">Only {item.maxQty} available — reduce quantity</p>
                ) : null}

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-lg border border-zinc-300 dark:border-zinc-600">
                    <button
                      aria-label="Decrease quantity"
                      className="px-2.5 py-1.5 text-zinc-500 hover:text-brand-600 disabled:opacity-40"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ itemId: item.id, qty: item.qty - 1 })}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                    <button
                      aria-label="Increase quantity"
                      className="px-2.5 py-1.5 text-zinc-500 hover:text-brand-600 disabled:opacity-40"
                      disabled={update.isPending || item.qty >= item.maxQty}
                      onClick={() => update.mutate({ itemId: item.id, qty: item.qty + 1 })}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => remove.mutate(item.id)}
                    className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-rose-600"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="space-y-4 rounded-card border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <CouponBox />
            <PriceSummary summary={cart.summary} couponCode={cart.couponCode} />
            <Button size="lg" className="w-full" disabled={hasStockIssue} onClick={() => router.push('/checkout')}>
              Proceed to Checkout
            </Button>
            {hasStockIssue && (
              <p className="text-center text-xs text-rose-600">Resolve stock issues above to continue.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
