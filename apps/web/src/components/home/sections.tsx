'use client';

import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';
import { ProductCardView } from '@/components/product/product-card';
import type { HomeData, Banner } from '@/lib/types';

function SectionShell({ title, href, flash, children }: { title: string; href?: string; flash?: boolean; children: React.ReactNode }) {
  return (
    <section className="fade-up">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight md:text-xl">
          {flash && <Zap className="size-5 fill-deal-500 text-deal-500" />}
          {title}
        </h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
            View all <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function ProductRow({ products }: { products: NonNullable<HomeData['sections'][number]['products']> }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:px-0 lg:grid-cols-5">
      {products.map((p, i) => (
        <div key={p.id} className={`w-40 shrink-0 sm:w-48 md:w-auto ${i >= 4 ? 'lg:block md:hidden' : ''} ${i >= 5 ? 'lg:hidden' : ''}`}>
          <ProductCardView product={p} />
        </div>
      ))}
    </div>
  );
}

export function HomeSections({ data }: { data: HomeData }) {
  const sectionHref: Record<string, string> = {
    FLASH_DEALS: '/products?minDiscount=20&sort=discount',
    TRENDING: '/products?sort=popular',
    NEW_ARRIVALS: '/products?sort=newest',
    BEST_SELLERS: '/products?sort=popular',
    TOP_RATED: '/products?sort=rating',
  };

  return (
    <div className="space-y-10">
      {data.sections.map((section) => {
        if (section.categories?.length) {
          return (
            <SectionShell key={section.key} title={section.title}>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:px-0">
                {section.categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/category/${c.slug}`}
                    className="group w-32 shrink-0 overflow-hidden rounded-card border border-zinc-200/80 bg-white text-center transition hover:-translate-y-0.5 hover:shadow-md md:w-auto dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" loading="lazy" className="aspect-square w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-zinc-100 text-3xl dark:bg-zinc-800">🛍️</div>
                    )}
                    <p className="p-2.5 text-sm font-semibold">{c.name}</p>
                  </Link>
                ))}
              </div>
            </SectionShell>
          );
        }
        if (section.brands?.length) {
          return (
            <SectionShell key={section.key} title={section.title}>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
                {section.brands.map((b) => (
                  <Link
                    key={b.id}
                    href={`/products?brands=${b.slug}`}
                    className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-card border border-zinc-200/80 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt="" loading="lazy" className="size-16 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">🏷️</div>
                    )}
                    <p className="text-sm font-semibold">{b.name}</p>
                  </Link>
                ))}
              </div>
            </SectionShell>
          );
        }
        if (section.products?.length) {
          return (
            <SectionShell
              key={section.key}
              title={section.title}
              href={sectionHref[section.type]}
              flash={section.type === 'FLASH_DEALS'}
            >
              <ProductRow products={section.products} />
            </SectionShell>
          );
        }
        return null;
      })}
    </div>
  );
}

export function PromoBanners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {banners.slice(0, 2).map((b) => {
        const inner = (
          <img src={b.imageUrl} alt={b.title} loading="lazy" className="aspect-[16/7] w-full rounded-2xl object-cover transition hover:opacity-95" />
        );
        return b.linkUrl ? (
          <Link key={b.id} href={b.linkUrl}>{inner}</Link>
        ) : (
          <div key={b.id}>{inner}</div>
        );
      })}
    </div>
  );
}
