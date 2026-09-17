'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Banner } from '@/lib/types';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;

  return (
    <section aria-label="Featured offers" className="relative overflow-hidden rounded-2xl">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b) => {
          const inner = (
            <>
              <img
                src={b.imageUrl}
                alt={b.title}
                className="hidden aspect-[16/5.2] w-full object-cover sm:block"
              />
              <img
                src={b.mobileImageUrl ?? b.imageUrl}
                alt={b.title}
                className="aspect-[16/10] w-full object-cover sm:hidden"
              />
            </>
          );
          return b.linkUrl ? (
            <Link key={b.id} href={b.linkUrl} className="w-full shrink-0">
              {inner}
            </Link>
          ) : (
            <div key={b.id} className="w-full shrink-0">
              {inner}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            aria-label="Previous banner"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-md transition hover:bg-white sm:flex dark:bg-zinc-900/85 dark:hover:bg-zinc-900"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            aria-label="Next banner"
            onClick={() => setIndex((i) => (i + 1) % count)}
            className="absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-md transition hover:bg-white sm:flex dark:bg-zinc-900/85 dark:hover:bg-zinc-900"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to banner ${i + 1}`}
                onClick={() => setIndex(i)}
                className={clsx(
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80',
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
