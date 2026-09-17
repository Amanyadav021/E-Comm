import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { publicFetch } from '@/lib/api';
import { ProductDetailView } from '@/components/product/product-detail';
import type { ProductDetail } from '@/lib/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await publicFetch<ProductDetail>(`/catalog/products/${slug}`, 120);
  if (!product) return { title: 'Product not found' };
  return {
    title: product.seo.title,
    description: product.seo.description ?? undefined,
    keywords: product.seo.keywords ?? undefined,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.seo.title,
      description: product.seo.description ?? undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await publicFetch<ProductDetail>(`/catalog/products/${slug}`, 120);
  if (!product) notFound();

  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription ?? product.description.slice(0, 200),
    image: product.images.map((i) => i.url),
    sku: product.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    aggregateRating:
      product.ratingCount > 0
        ? { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount }
        : undefined,
    offers: defaultVariant
      ? {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: defaultVariant.price,
          availability: defaultVariant.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        }
      : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetailView product={product} />
    </>
  );
}
