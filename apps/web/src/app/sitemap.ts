import type { MetadataRoute } from 'next';
import { publicFetch } from '@/lib/api';
import type { CategoryNode } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    publicFetch<CategoryNode[]>('/catalog/categories', 3600),
    publicFetch<{ items: Array<{ slug: string }> }>('/catalog/products?pageSize=60&sort=popular', 3600),
  ]);

  return [
    { url: BASE, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/products`, changeFrequency: 'daily', priority: 0.9 },
    ...flatten(categories ?? []).map((c) => ({
      url: `${BASE}/category/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...(products?.items ?? []).map((p) => ({
      url: `${BASE}/product/${p.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
