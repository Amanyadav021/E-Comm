import { publicFetch } from '@/lib/api';
import { HeroCarousel } from '@/components/home/hero-carousel';
import { HomeSections, PromoBanners } from '@/components/home/sections';
import type { HomeData } from '@/lib/types';

export const revalidate = 60;

export default async function HomePage() {
  const data = await publicFetch<HomeData>('/content/home', 60);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <p className="text-4xl">🔌</p>
        <h1 className="mt-4 text-xl font-bold">We&apos;ll be right back</h1>
        <p className="mt-2 text-sm text-zinc-500">
          The store is temporarily unavailable. Please refresh in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-4 md:py-6">
      <HeroCarousel banners={data.banners.hero} />
      <HomeSections data={{ ...data, sections: data.sections.slice(0, 2) }} />
      <PromoBanners banners={data.banners.promo} />
      <HomeSections data={{ ...data, sections: data.sections.slice(2) }} />
    </div>
  );
}
