export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  hoverImage: string | null;
  mrp: number;
  price: number;
  discountPct: number;
  offerBadge: string | null;
  ratingAvg: number;
  ratingCount: number;
  inStock: boolean;
  defaultVariantId: string | null;
  wishlisted: boolean;
  priceAtAdd?: number;
  priceDropped?: boolean;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  iconName: string | null;
  isFeatured: boolean;
  children: CategoryNode[];
}

export interface VariantDetail {
  id: string;
  sku: string;
  name: string | null;
  options: Record<string, string>;
  mrp: number;
  price: number;
  discountPct: number;
  offerBadge: string | null;
  inStock: boolean;
  lowStock: boolean;
  availableQty: number;
  isDefault: boolean;
  images: Array<{ url: string; alt: string | null }>;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string; parent: { name: string; slug: string } | null };
  description: string;
  shortDescription: string | null;
  specifications: Array<{ group: string; items: Array<{ label: string; value: string }> }>;
  features: string[];
  optionTypes: string[];
  warranty: string | null;
  returnPolicy: string | null;
  returnWindowDays: number;
  isReturnable: boolean;
  codAvailable: boolean;
  images: Array<{ url: string; alt: string | null }>;
  variants: VariantDetail[];
  ratingAvg: number;
  ratingCount: number;
  reviewCount: number;
  soldCount: number;
  ratingDistribution: Array<{ rating: number; count: number }>;
  recentReviews: Array<{
    id: string; rating: number; title: string | null; body: string | null;
    author: string; isVerified: boolean; createdAt: string; images: string[];
  }>;
  related: ProductCard[];
  seo: { title: string; description: string | null; keywords: string | null };
}

export interface CartData {
  id: string;
  couponCode: string | null;
  couponError: string | null;
  items: Array<{
    id: string; variantId: string; productId: string; slug: string; name: string;
    image: string | null; options: Record<string, string>; qty: number; maxQty: number;
    mrp: number; price: number; offerBadge: string | null; lineTotal: number;
    inStock: boolean; insufficientStock: boolean; codAvailable: boolean;
  }>;
  summary: {
    subtotal: number; productDiscount: number; offerDiscount: number; couponDiscount: number;
    shippingFee: number; taxAmount: number; total: number; itemCount: number;
    freeShippingAbove: number | null;
  };
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  area: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  type: 'HOME' | 'WORK' | 'OTHER';
  isDefault: boolean;
}

export interface OrderSummaryRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  placedAt: string;
  expectedDeliveryAt: string | null;
  deliveredAt: string | null;
  itemCount: number;
  preview: Array<{ name: string; image: string | null; qty: number }>;
}

export interface HomeData {
  banners: {
    hero: Banner[];
    promo: Banner[];
    strip: Banner[];
  };
  sections: Array<{
    key: string; title: string; type: string;
    products?: ProductCard[];
    categories?: Array<{ id: string; name: string; slug: string; imageUrl: string | null; iconName: string | null }>;
    brands?: Array<{ id: string; name: string; slug: string; logoUrl: string | null }>;
  }>;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
}

export interface ListResponse {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    priceMin: number;
    priceMax: number;
    brands: Array<{ id: string; name: string; slug: string; count: number }>;
  } | null;
}
