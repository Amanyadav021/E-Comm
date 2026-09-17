'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ListFilter, SearchX, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { ProductCardView, ProductCardSkeleton } from '@/components/product/product-card';
import { EmptyState, Button } from '@/components/ui';
import type { ListResponse } from '@/lib/types';

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Popularity' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'discount', label: 'Biggest Discount' },
];

const PRICE_BUCKETS = [
  { label: 'Under ₹500', min: undefined, max: 500 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 – ₹5,000', min: 1000, max: 5000 },
  { label: '₹5,000 – ₹20,000', min: 5000, max: 20000 },
  { label: 'Over ₹20,000', min: 20000, max: undefined },
];

function FilterPanel({
  data,
  params,
  setParam,
  clearFilters,
  activeCount,
}: {
  data: ListResponse | undefined;
  params: URLSearchParams;
  setParam: (updates: Record<string, string | undefined>) => void;
  clearFilters: () => void;
  activeCount: number;
}) {
  const selectedBrands = (params.get('brands') ?? '').split(',').filter(Boolean);
  const minPrice = params.get('minPrice');
  const maxPrice = params.get('maxPrice');
  const minRating = params.get('minRating');
  const minDiscount = params.get('minDiscount');
  const inStock = params.get('inStock') === 'true';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Filters</h2>
        {activeCount > 0 && (
          <button onClick={clearFilters} className="text-xs font-semibold text-brand-600 hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Price</legend>
        <div className="space-y-1.5">
          {PRICE_BUCKETS.map((b) => {
            const active = String(b.min ?? '') === (minPrice ?? '') && String(b.max ?? '') === (maxPrice ?? '');
            return (
              <label key={b.label} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="radio"
                  name="price"
                  checked={active}
                  onChange={() => setParam({ minPrice: b.min?.toString(), maxPrice: b.max?.toString(), page: undefined })}
                  className="accent-brand-600"
                />
                {b.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {data?.facets?.brands && data.facets.brands.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Brand</legend>
          <div className="max-h-52 space-y-1.5 overflow-y-auto">
            {data.facets.brands.map((b) => (
              <label key={b.slug} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.slug)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selectedBrands, b.slug]
                      : selectedBrands.filter((s) => s !== b.slug);
                    setParam({ brands: next.length ? next.join(',') : undefined, page: undefined });
                  }}
                  className="accent-brand-600"
                />
                <span className="flex-1">{b.name}</span>
                <span className="text-xs text-zinc-400">{b.count}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Customer rating</legend>
        <div className="space-y-1.5">
          {[4, 3, 2].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="radio"
                name="rating"
                checked={minRating === String(r)}
                onChange={() => setParam({ minRating: String(r), page: undefined })}
                className="accent-brand-600"
              />
              <span className="flex items-center gap-1">
                {r} <Star className="size-3.5 fill-amber-400 text-amber-400" /> &amp; above
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Discount</legend>
        <div className="space-y-1.5">
          {[10, 25, 40, 60].map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="radio"
                name="discount"
                checked={minDiscount === String(d)}
                onChange={() => setParam({ minDiscount: String(d), page: undefined })}
                className="accent-brand-600"
              />
              {d}% or more
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setParam({ inStock: e.target.checked ? 'true' : undefined, page: undefined })}
          className="accent-brand-600"
        />
        In stock only
      </label>
    </div>
  );
}

export function ProductListing({ categorySlug, title }: { categorySlug?: string; title?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const params = new URLSearchParams(searchParams.toString());
  if (categorySlug) params.set('category', categorySlug);
  const queryString = params.toString();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', queryString],
    queryFn: () => api.get<ListResponse>(`/catalog/products?${queryString}`),
    placeholderData: keepPreviousData,
  });

  const setParam = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) next.delete(key);
        else next.set(key, value);
      }
      router.push(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const FILTER_KEYS = ['minPrice', 'maxPrice', 'minRating', 'minDiscount', 'inStock', 'brands'];
  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    FILTER_KEYS.forEach((k) => next.delete(k));
    next.delete('page');
    router.push(`?${next.toString()}`, { scroll: false });
  };

  const q = searchParams.get('q');
  const page = Number(searchParams.get('page') ?? 1);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 md:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            {title ?? (q ? `Results for “${q}”` : 'All Products')}
          </h1>
          {data && <p className="text-sm text-zinc-500">{data.total} product{data.total === 1 ? '' : 's'}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium lg:hidden dark:border-zinc-700"
          >
            <ListFilter className="size-4" />
            Filters
            {activeCount > 0 && (
              <span className="flex size-4.5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
          <select
            aria-label="Sort products"
            value={searchParams.get('sort') ?? 'relevance'}
            onChange={(e) => setParam({ sort: e.target.value === 'relevance' ? undefined : e.target.value, page: undefined })}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-32 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <FilterPanel data={data} params={params} setParam={setParam} clearFilters={clearFilters} activeCount={activeCount} />
          </div>
        </aside>

        {/* Grid */}
        <div className={clsx('flex-1', isFetching && !isLoading && 'opacity-60 transition-opacity')}>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title={q ? `No results for “${q}”` : 'No products found'}
              text="Try different keywords or remove some filters."
              action={{ label: 'Browse all products', href: '/products' }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {data.items.map((p, i) => (
                  <ProductCardView key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>
                    <ChevronLeft className="size-4" /> Prev
                  </Button>
                  <span className="px-3 text-sm text-zinc-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setParam({ page: String(page + 1) })}>
                    Next <ChevronRight className="size-4" />
                  </Button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-zinc-900/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <span className="font-bold">Filters</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close filters">
                <X className="size-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FilterPanel data={data} params={params} setParam={setParam} clearFilters={clearFilters} activeCount={activeCount} />
            </div>
            <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
              <Button className="w-full" onClick={() => setDrawerOpen(false)}>
                Show {data?.total ?? 0} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
