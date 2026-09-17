import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { dec, fromJson } from '../common/utils';
import { applyOffers, discountPct, type OfferInput } from '@shopcraft/shared';

export interface ListQuery {
  q?: string;
  category?: string; // slug
  brands?: string[]; // slugs
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStock?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'rating' | 'discount';
  page: number;
  pageSize: number;
}

const ACTIVE_PRODUCT: Prisma.ProductWhereInput = { status: 'ACTIVE', deletedAt: null };

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  // ---------------- Categories & brands ----------------

  async categoryTree() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const byParent = new Map<string | null, typeof categories>();
    for (const c of categories) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    const toNode = (c: (typeof categories)[number]): any => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl,
      iconName: c.iconName,
      isFeatured: c.isFeatured,
      children: (byParent.get(c.id) ?? []).map(toNode),
    });
    return (byParent.get(null) ?? []).map(toNode);
  }

  async brands() {
    return this.prisma.brand.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, logoUrl: true, isFeatured: true },
    });
  }

  /** Category and all its descendants (for filtering). */
  private async categoryWithDescendants(slug: string): Promise<string[] | null> {
    const all = await this.prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, slug: true, parentId: true },
    });
    const root = all.find((c) => c.slug === slug);
    if (!root) return null;
    const ids: string[] = [];
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift()!;
      ids.push(id);
      for (const c of all) if (c.parentId === id) queue.push(c.id);
    }
    return ids;
  }

  // ---------------- Product listing ----------------

  async listProducts(query: ListQuery, userId?: string) {
    const where: Prisma.ProductWhereInput = { ...ACTIVE_PRODUCT };
    const and: Prisma.ProductWhereInput[] = [];

    if (query.category) {
      const ids = await this.categoryWithDescendants(query.category);
      if (!ids) return { items: [], total: 0, page: query.page, pageSize: query.pageSize, facets: null };
      and.push({ categoryId: { in: ids } });
    }
    if (query.brands?.length) {
      and.push({ brand: { slug: { in: query.brands } } });
    }
    if (query.minPrice != null) and.push({ minPrice: { gte: new Prisma.Decimal(query.minPrice) } });
    if (query.maxPrice != null) and.push({ minPrice: { lte: new Prisma.Decimal(query.maxPrice) } });
    if (query.minRating != null) and.push({ ratingAvg: { gte: new Prisma.Decimal(query.minRating) } });
    if (query.minDiscount != null) and.push({ discountPct: { gte: query.minDiscount } });
    if (query.inStock) and.push({ variants: { some: { stockOnHand: { gt: 0 }, isActive: true, deletedAt: null } } });

    if (query.q) {
      const q = query.q.trim();
      and.push({
        OR: [
          { name: { contains: q } },
          { shortDescription: { contains: q } },
          { brand: { name: { contains: q } } },
          { category: { name: { contains: q } } },
          { sku: { contains: q } },
        ],
      });
      this.recordSearch(q).catch(() => undefined);
    }
    if (and.length) where.AND = and;

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
      switch (query.sort) {
        case 'price_asc':
          return [{ minPrice: 'asc' as const }];
        case 'price_desc':
          return [{ minPrice: 'desc' as const }];
        case 'newest':
          return [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];
        case 'rating':
          return [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }];
        case 'discount':
          return [{ discountPct: 'desc' as const }];
        case 'popular':
          return [{ soldCount: 'desc' as const }, { viewCount: 'desc' as const }];
        default: // relevance
          return query.q
            ? [{ soldCount: 'desc' as const }, { ratingCount: 'desc' as const }]
            : [{ isFeatured: 'desc' as const }, { soldCount: 'desc' as const }];
      }
    })();

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: this.cardInclude(),
      }),
    ]);

    const offers = await this.pricing.getActiveOffers();
    const items = await Promise.all(rows.map((p) => this.toCard(p, offers, userId)));

    // Facets for the filter drawer
    const facets = await this.facets(where);

    return { items, total, page: query.page, pageSize: query.pageSize, facets };
  }

  private cardInclude() {
    return {
      brand: { select: { name: true, slug: true } },
      images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }], take: 2 },
      variants: {
        where: { isActive: true, deletedAt: null },
        select: { id: true, price: true, mrp: true, stockOnHand: true, stockReserved: true, isDefault: true },
      },
    } satisfies Prisma.ProductInclude;
  }

  private async facets(where: Prisma.ProductWhereInput) {
    const [priceAgg, brandGroups] = await Promise.all([
      this.prisma.product.aggregate({ where, _min: { minPrice: true }, _max: { minPrice: true } }),
      this.prisma.product.groupBy({ by: ['brandId'], where, _count: { _all: true } }),
    ]);
    const brandIds = brandGroups.map((b) => b.brandId).filter((x): x is string => !!x);
    const brandRows = brandIds.length
      ? await this.prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true, slug: true } })
      : [];
    const brandMap = new Map(brandRows.map((b) => [b.id, b]));
    return {
      priceMin: dec(priceAgg._min.minPrice),
      priceMax: dec(priceAgg._max.minPrice),
      brands: brandGroups
        .filter((g) => g.brandId && brandMap.has(g.brandId))
        .map((g) => ({ ...brandMap.get(g.brandId!)!, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private async toCard(p: any, offers: OfferInput[], userId?: string) {
    const defaultVariant = p.variants.find((v: any) => v.isDefault) ?? p.variants[0];
    const price = dec(defaultVariant?.price ?? p.minPrice);
    const mrp = dec(defaultVariant?.mrp ?? p.maxMrp);
    const [priced] = applyOffers(
      [{ variantId: defaultVariant?.id ?? '', productId: p.id, categoryId: p.categoryId, qty: 1, mrp, price, taxRatePct: dec(p.taxRatePct) }],
      offers,
    );
    const available = p.variants.some((v: any) => v.stockOnHand - v.stockReserved > 0);
    let wishlisted = false;
    if (userId) {
      wishlisted = !!(await this.prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId, productId: p.id } },
        select: { id: true },
      }));
    }
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand?.name ?? null,
      image: p.images[0]?.url ?? null,
      hoverImage: p.images[1]?.url ?? null,
      mrp,
      price: priced.effectiveUnitPrice,
      discountPct: discountPct(mrp, priced.effectiveUnitPrice),
      offerBadge: priced.offerBadge,
      ratingAvg: dec(p.ratingAvg),
      ratingCount: p.ratingCount,
      inStock: available,
      defaultVariantId: defaultVariant?.id ?? null,
      wishlisted,
    };
  }

  // ---------------- Product detail ----------------

  async getProduct(slug: string, userId?: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, ...ACTIVE_PRODUCT },
      include: {
        brand: true,
        category: { include: { parent: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: { where: { isActive: true, deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Product not found');

    const offers = await this.pricing.getActiveOffers();
    const variants = p.variants.map((v) => {
      const [priced] = applyOffers(
        [{ variantId: v.id, productId: p.id, categoryId: p.categoryId, qty: 1, mrp: dec(v.mrp), price: dec(v.price), taxRatePct: dec(p.taxRatePct) }],
        offers,
      );
      const available = v.stockOnHand - v.stockReserved;
      return {
        id: v.id,
        sku: v.sku,
        name: v.name,
        options: fromJson<Record<string, string>>(v.options, {}),
        mrp: dec(v.mrp),
        price: priced.effectiveUnitPrice,
        basePrice: dec(v.price),
        discountPct: discountPct(dec(v.mrp), priced.effectiveUnitPrice),
        offerBadge: priced.offerBadge,
        inStock: available > 0,
        lowStock: available > 0 && available <= v.lowStockThreshold,
        availableQty: Math.max(0, available),
        isDefault: v.isDefault,
        images: p.images.filter((i) => i.variantId === v.id).map((i) => ({ url: i.url, alt: i.alt })),
      };
    });

    const [ratingGroups, recentReviews, related] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId: p.id, status: 'APPROVED', deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.review.findMany({
        where: { productId: p.id, status: 'APPROVED', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } }, images: true },
      }),
      this.prisma.product.findMany({
        where: { categoryId: p.categoryId, id: { not: p.id }, ...ACTIVE_PRODUCT },
        orderBy: { soldCount: 'desc' },
        take: 8,
        include: this.cardInclude(),
      }),
    ]);

    if (userId) {
      await this.prisma.recentlyViewed.upsert({
        where: { userId_productId: { userId, productId: p.id } },
        create: { userId, productId: p.id },
        update: { viewedAt: new Date() },
      });
    }
    this.prisma.product
      .update({ where: { id: p.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    const relatedCards = await Promise.all(related.map((r) => this.toCard(r, offers, userId)));

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      sku: p.sku,
      brand: p.brand ? { name: p.brand.name, slug: p.brand.slug } : null,
      category: {
        name: p.category.name,
        slug: p.category.slug,
        parent: p.category.parent ? { name: p.category.parent.name, slug: p.category.parent.slug } : null,
      },
      description: p.description,
      shortDescription: p.shortDescription,
      specifications: fromJson(p.specifications, [] as Array<{ group: string; items: Array<{ label: string; value: string }> }>),
      features: fromJson(p.features, [] as string[]),
      optionTypes: fromJson(p.optionTypes, [] as string[]),
      warranty: p.warranty,
      returnPolicy: p.returnPolicy,
      returnWindowDays: p.returnWindowDays,
      isReturnable: p.isReturnable,
      codAvailable: p.codAvailable,
      images: p.images.filter((i) => !i.variantId).map((i) => ({ url: i.url, alt: i.alt })),
      variants,
      ratingAvg: dec(p.ratingAvg),
      ratingCount: p.ratingCount,
      reviewCount: p.reviewCount,
      soldCount: p.soldCount,
      ratingDistribution: [5, 4, 3, 2, 1].map((r) => ({
        rating: r,
        count: ratingGroups.find((g) => g.rating === r)?._count._all ?? 0,
      })),
      recentReviews: recentReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        author: r.user.name,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        images: r.images.map((i) => i.url),
      })),
      related: relatedCards,
      seo: { title: p.seoTitle ?? p.name, description: p.seoDescription ?? p.shortDescription, keywords: p.seoKeywords },
    };
  }

  /** Serviceability + delivery estimate for the PDP pincode checker. */
  async checkDelivery(pincode: string) {
    const zone = await this.pricing.resolveShippingZone(pincode);
    if (!zone) return { serviceable: false };
    const eta = new Date();
    eta.setDate(eta.getDate() + zone.maxDeliveryDays);
    return {
      serviceable: true,
      minDays: zone.minDeliveryDays,
      maxDays: zone.maxDeliveryDays,
      estimatedDate: eta,
      codAvailable: zone.codAvailable,
      fee: dec(zone.fee),
      freeAbove: zone.freeAbove == null ? null : dec(zone.freeAbove),
    };
  }

  // ---------------- Search ----------------

  private async recordSearch(term: string) {
    const t = term.toLowerCase().slice(0, 100);
    if (t.length < 2) return;
    await this.prisma.searchQuery.upsert({
      where: { term: t },
      create: { term: t },
      update: { count: { increment: 1 }, lastSearchedAt: new Date() },
    });
  }

  async suggestions(q: string) {
    const term = q.trim();
    if (term.length < 2) return { products: [], categories: [], brands: [] };
    const [products, categories, brands] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...ACTIVE_PRODUCT, OR: [{ name: { contains: term } }, { brand: { name: { contains: term } } }] },
        orderBy: { soldCount: 'desc' },
        take: 6,
        select: {
          name: true,
          slug: true,
          minPrice: true,
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { url: true } },
        },
      }),
      this.prisma.category.findMany({
        where: { isActive: true, deletedAt: null, name: { contains: term } },
        take: 3,
        select: { name: true, slug: true },
      }),
      this.prisma.brand.findMany({
        where: { isActive: true, deletedAt: null, name: { contains: term } },
        take: 3,
        select: { name: true, slug: true },
      }),
    ]);
    return {
      products: products.map((p) => ({ name: p.name, slug: p.slug, price: dec(p.minPrice), image: p.images[0]?.url ?? null })),
      categories,
      brands,
    };
  }

  async popularSearches() {
    const rows = await this.prisma.searchQuery.findMany({ orderBy: { count: 'desc' }, take: 8 });
    return rows.map((r) => r.term);
  }

  /** Shared helper for content/home sections: card-shaped products by filter. */
  async cardsByIds(ids: string[], userId?: string) {
    if (!ids.length) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, ...ACTIVE_PRODUCT },
      include: this.cardInclude(),
    });
    const offers = await this.pricing.getActiveOffers();
    const cards = await Promise.all(rows.map((p) => this.toCard(p, offers, userId)));
    // preserve requested order
    const pos = new Map(ids.map((id, i) => [id, i]));
    return cards.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  }

  async cards(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput[], take: number, userId?: string) {
    const rows = await this.prisma.product.findMany({
      where: { ...ACTIVE_PRODUCT, ...where },
      orderBy,
      take,
      include: this.cardInclude(),
    });
    const offers = await this.pricing.getActiveOffers();
    return Promise.all(rows.map((p) => this.toCard(p, offers, userId)));
  }
}
