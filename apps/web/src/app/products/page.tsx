import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProductListing } from '@/components/product/product-listing';
import { Spinner } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse the full ShopCraft catalog — electronics, fashion, home, beauty and more.',
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProductListing />
    </Suspense>
  );
}
