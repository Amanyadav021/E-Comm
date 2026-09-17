import { Suspense } from 'react';
import type { Metadata } from 'next';
import { publicFetch } from '@/lib/api';
import { ProductListing } from '@/components/product/product-listing';
import { Spinner } from '@/components/ui';
import type { CategoryNode } from '@/lib/types';

interface Props {
  params: Promise<{ slug: string }>;
}

function findCategory(nodes: CategoryNode[], slug: string): CategoryNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findCategory(node.children, slug);
    if (child) return child;
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const categories = await publicFetch<CategoryNode[]>('/catalog/categories', 300);
  const category = categories ? findCategory(categories, slug) : null;
  return {
    title: category ? `${category.name} — Shop Online` : 'Category',
    description: category
      ? `Shop the best ${category.name.toLowerCase()} at ShopCraft. Great prices, fast delivery, easy returns.`
      : undefined,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const categories = await publicFetch<CategoryNode[]>('/catalog/categories', 300);
  const category = categories ? findCategory(categories, slug) : null;

  return (
    <Suspense fallback={<Spinner />}>
      <ProductListing categorySlug={slug} title={category?.name} />
    </Suspense>
  );
}
