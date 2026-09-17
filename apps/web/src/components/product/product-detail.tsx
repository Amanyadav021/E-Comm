'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  BadgeCheck, ChevronRight, MapPin, Minus, Plus, RotateCcw, Share2, ShieldCheck,
  ShoppingCart, Star, Tag, Truck, Zap,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/components/providers';
import { Button } from '@/components/ui';
import { ProductCardView, Rating, WishlistHeart } from './product-card';
import type { ProductDetail, VariantDetail } from '@/lib/types';

// ---------------- Gallery with hover zoom ----------------

function Gallery({ images, name }: { images: Array<{ url: string; alt: string | null }>; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const current = images[Math.min(index, images.length - 1)];

  if (!current) {
    return <div className="flex aspect-square items-center justify-center rounded-2xl bg-zinc-100 text-6xl dark:bg-zinc-800">🛍️</div>;
  }

  return (
    <div>
      <div
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <img
          src={current.url}
          alt={current.alt ?? name}
          className="size-full object-contain transition-transform duration-150"
          style={zoom ? { transform: 'scale(1.9)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              onClick={() => setIndex(i)}
              aria-label={`View image ${i + 1}`}
              className={clsx(
                'size-16 shrink-0 overflow-hidden rounded-xl border-2 transition',
                i === index ? 'border-brand-500' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={img.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Pincode / delivery check ----------------

interface DeliveryInfo {
  serviceable: boolean;
  minDays?: number;
  maxDays?: number;
  estimatedDate?: string;
  codAvailable?: boolean;
  fee?: number;
  freeAbove?: number | null;
}

function DeliveryCheck({ codAllowed }: { codAllowed: boolean }) {
  const [pincode, setPincode] = useState('');
  const [info, setInfo] = useState<DeliveryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      setError('Enter a valid 6-digit pincode');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      setInfo(await api.get<DeliveryInfo>(`/catalog/delivery/${pincode}`));
    } catch {
      setError('Could not check delivery right now');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <MapPin className="size-4.5 text-brand-600" />
        <input
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          placeholder="Enter delivery pincode"
          aria-label="Delivery pincode"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
        <button onClick={check} disabled={loading} className="text-sm font-semibold text-brand-600 hover:underline disabled:opacity-50">
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {info && (
        <div className="mt-2 space-y-1 text-sm">
          {info.serviceable ? (
            <>
              <p className="flex items-center gap-1.5 text-emerald-600">
                <Truck className="size-4" />
                Delivery by <strong>{formatDate(info.estimatedDate!)}</strong>
              </p>
              <p className="text-xs text-zinc-500">
                {info.fee === 0 || (info.freeAbove != null) ? `Free delivery on orders above ${formatINR(info.freeAbove ?? 0)} · ` : ''}
                {codAllowed && info.codAvailable ? 'Cash on Delivery available' : 'Prepaid only'}
              </p>
            </>
          ) : (
            <p className="text-rose-600">Sorry, we don&apos;t deliver to this pincode yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- Main view ----------------

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { add } = useCart();

  const [selectedId, setSelectedId] = useState(
    (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.id,
  );
  const [qty, setQty] = useState(1);
  const variant = product.variants.find((v) => v.id === selectedId) ?? product.variants[0];

  // Option-axis selection (Size / Color / …)
  const optionAxes = useMemo(() => {
    return product.optionTypes.map((type) => ({
      type,
      values: Array.from(new Set(product.variants.map((v) => v.options[type]).filter(Boolean))),
    }));
  }, [product]);

  const selectOption = (type: string, value: string) => {
    const target =
      product.variants.find(
        (v) => v.options[type] === value &&
          Object.entries(variant.options).every(([k, val]) => k === type || v.options[k] === val),
      ) ?? product.variants.find((v) => v.options[type] === value);
    if (target) {
      setSelectedId(target.id);
      setQty(1);
    }
  };

  const galleryImages = variant?.images.length ? variant.images : product.images;

  const requireAuth = () => {
    if (!user) {
      router.push(`/login?next=/product/${product.slug}`);
      return false;
    }
    return true;
  };

  const addToCart = () => {
    if (!requireAuth() || !variant) return;
    add.mutate({ variantId: variant.id, qty });
  };

  const buyNow = () => {
    if (!requireAuth() || !variant) return;
    add.mutate(
      { variantId: variant.id, qty },
      { onSuccess: () => router.push('/checkout') },
    );
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('success', 'Link copied to clipboard');
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 md:py-6">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-zinc-500">
        <Link href="/" className="hover:text-brand-600">Home</Link>
        <ChevronRight className="size-3.5 shrink-0" />
        {product.category.parent && (
          <>
            <Link href={`/category/${product.category.parent.slug}`} className="hover:text-brand-600">
              {product.category.parent.name}
            </Link>
            <ChevronRight className="size-3.5 shrink-0" />
          </>
        )}
        <Link href={`/category/${product.category.slug}`} className="hover:text-brand-600">
          {product.category.name}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="truncate text-zinc-800 dark:text-zinc-200">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Gallery images={galleryImages} name={product.name} />
        </div>

        <div>
          {product.brand && (
            <Link href={`/products?brands=${product.brand.slug}`} className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              {product.brand.name}
            </Link>
          )}
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold leading-snug md:text-2xl">{product.name}</h1>
            <div className="flex shrink-0 gap-2">
              <WishlistHeart productId={product.id} />
              <button
                onClick={share}
                aria-label="Share"
                className="flex size-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-900/5 hover:scale-105 dark:bg-zinc-800 dark:ring-white/10"
              >
                <Share2 className="size-4.5 text-zinc-500 dark:text-zinc-300" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Rating value={product.ratingAvg} count={product.ratingCount} size="md" />
            {product.soldCount > 10 && <span className="text-xs text-zinc-400">{product.soldCount}+ sold</span>}
          </div>

          {/* Price */}
          <div className="mt-4 flex flex-wrap items-baseline gap-2.5">
            <span className="text-3xl font-extrabold">{formatINR(variant?.price ?? 0)}</span>
            {variant && variant.mrp > variant.price && (
              <>
                <span className="text-base text-zinc-400 line-through">{formatINR(variant.mrp)}</span>
                <span className="text-base font-bold text-emerald-600">{variant.discountPct}% off</span>
              </>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">Inclusive of all taxes</p>
          {variant?.offerBadge && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              <Tag className="size-4" /> {variant.offerBadge} applied — extra savings included in this price
            </p>
          )}

          {/* Variant options */}
          {optionAxes.map((axis) => (
            <fieldset key={axis.type} className="mt-5">
              <legend className="mb-2 text-sm font-semibold">
                {axis.type}: <span className="font-normal text-zinc-500">{variant?.options[axis.type]}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {axis.values.map((value) => {
                  const active = variant?.options[axis.type] === value;
                  const target = product.variants.find((v) => v.options[axis.type] === value);
                  const disabled = target ? !target.inStock && product.variants.filter((v) => v.options[axis.type] === value).every((v) => !v.inStock) : false;
                  return (
                    <button
                      key={value}
                      onClick={() => selectOption(axis.type, value)}
                      disabled={disabled}
                      className={clsx(
                        'rounded-xl border px-3.5 py-2 text-sm font-medium transition',
                        active
                          ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-800'
                          : 'border-zinc-300 hover:border-brand-300 dark:border-zinc-600',
                        disabled && 'opacity-40 line-through',
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {/* Stock + qty */}
          <div className="mt-5 flex items-center gap-4">
            {variant?.inStock ? (
              <>
                <div className="flex items-center rounded-xl border border-zinc-300 dark:border-zinc-600">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => setQty((n) => Math.max(1, n - 1))}
                    className="px-3 py-2 text-zinc-500 hover:text-brand-600 disabled:opacity-40"
                    disabled={qty <= 1}
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{qty}</span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() => setQty((n) => Math.min(Math.min(10, variant.availableQty), n + 1))}
                    className="px-3 py-2 text-zinc-500 hover:text-brand-600 disabled:opacity-40"
                    disabled={qty >= Math.min(10, variant.availableQty)}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                {variant.lowStock && (
                  <span className="text-sm font-semibold text-amber-600">Only {variant.availableQty} left!</span>
                )}
              </>
            ) : (
              <span className="rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 dark:bg-rose-900/30">
                Currently out of stock
              </span>
            )}
          </div>

          {/* CTAs */}
          <div className="sticky bottom-16 z-30 -mx-4 mt-5 flex gap-3 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur md:static md:z-auto md:m-0 md:border-0 md:bg-transparent md:p-0 dark:border-zinc-800 dark:bg-zinc-950/95 md:dark:bg-transparent">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={!variant?.inStock}
              loading={add.isPending}
              onClick={addToCart}
            >
              <ShoppingCart className="size-5" /> Add to Cart
            </Button>
            <Button size="lg" className="flex-1" disabled={!variant?.inStock} onClick={buyNow}>
              <Zap className="size-5" /> Buy Now
            </Button>
          </div>

          {/* Delivery + policies */}
          <div className="mt-5 space-y-3">
            <DeliveryCheck codAllowed={product.codAvailable} />
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-zinc-500">
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <RotateCcw className="mx-auto mb-1 size-5 text-brand-600" />
                {product.isReturnable ? `${product.returnWindowDays}-day returns` : 'Non-returnable'}
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <ShieldCheck className="mx-auto mb-1 size-5 text-brand-600" />
                {product.warranty ?? 'Genuine product'}
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <Truck className="mx-auto mb-1 size-5 text-brand-600" />
                Fast delivery
              </div>
            </div>
          </div>

          {/* Description & specs */}
          <section className="mt-8">
            <h2 className="mb-2 text-lg font-bold">About this item</h2>
            {product.features.length > 0 && (
              <ul className="mb-3 list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                {product.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {product.description}
            </p>
          </section>

          {product.specifications.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-lg font-bold">Specifications</h2>
              {product.specifications.map((group) => (
                <div key={group.group} className="mb-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <p className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900">
                    {group.group}
                  </p>
                  <dl>
                    {group.items.map((item, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 border-b border-zinc-100 px-4 py-2 text-sm last:border-0 dark:border-zinc-800">
                        <dt className="text-zinc-400">{item.label}</dt>
                        <dd className="col-span-2">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-12">
        <h2 className="mb-4 text-xl font-bold">Ratings &amp; Reviews</h2>
        {product.ratingCount === 0 ? (
          <p className="text-sm text-zinc-500">No reviews yet. Purchased this product? Rate it from your orders page.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-extrabold">{product.ratingAvg.toFixed(1)}</span>
                <div className="pb-1.5">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={clsx('size-4', s <= Math.round(product.ratingAvg) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300')} />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400">{product.ratingCount} ratings</p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {product.ratingDistribution.map((d) => {
                  const pct = product.ratingCount ? Math.round((d.count / product.ratingCount) * 100) : 0;
                  return (
                    <div key={d.rating} className="flex items-center gap-2 text-xs">
                      <span className="w-3 font-medium">{d.rating}</span>
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-zinc-400">{d.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-4 md:col-span-2">
              {product.recentReviews.map((r) => (
                <article key={r.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      {r.rating} <Star className="size-2.5 fill-current" />
                    </span>
                    {r.title && <span className="text-sm font-semibold">{r.title}</span>}
                  </div>
                  {r.body && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{r.body}</p>}
                  <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    {r.author} · {formatDate(r.createdAt)}
                    {r.isVerified && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600">
                        <BadgeCheck className="size-3.5" /> Verified purchase
                      </span>
                    )}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Related */}
      {product.related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">You may also like</h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:px-0 lg:grid-cols-5">
            {product.related.map((p) => (
              <div key={p.id} className="w-40 shrink-0 sm:w-48 md:w-auto">
                <ProductCardView product={p} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
