import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { fromJson } from '../common/utils';
import { Public, CurrentUser, AuthUser } from '../auth/decorators';

/**
 * Public storefront content: the admin-configurable homepage.
 * Sections and banners are managed in the admin dashboard; the storefront
 * renders whatever this endpoint returns, in order.
 */
@Public()
@Controller('content')
export class ContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('home')
  async home(@CurrentUser() user?: AuthUser) {
    const now = new Date();
    const activeWindow = {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    };

    const [banners, sections] = await Promise.all([
      this.prisma.banner.findMany({ where: activeWindow, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.homeSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ]);

    const resolvedSections = [] as Array<Record<string, unknown>>;
    for (const s of sections) {
      const config = fromJson<Record<string, any>>(s.config, {});
      const limit = Math.min(Number(config.limit) || 10, 20);
      const base = { key: s.key, title: s.title, type: s.type };
      switch (s.type) {
        case 'FLASH_DEALS':
          resolvedSections.push({ ...base, products: await this.catalog.cards({ discountPct: { gte: Number(config.minDiscount) || 20 } }, [{ discountPct: 'desc' }], limit, user?.id) });
          break;
        case 'TRENDING':
          resolvedSections.push({ ...base, products: await this.catalog.cards({}, [{ viewCount: 'desc' }, { soldCount: 'desc' }], limit, user?.id) });
          break;
        case 'BEST_SELLERS':
          resolvedSections.push({ ...base, products: await this.catalog.cards({}, [{ soldCount: 'desc' }], limit, user?.id) });
          break;
        case 'NEW_ARRIVALS':
          resolvedSections.push({ ...base, products: await this.catalog.cards({}, [{ publishedAt: 'desc' }, { createdAt: 'desc' }], limit, user?.id) });
          break;
        case 'TOP_RATED':
          resolvedSections.push({ ...base, products: await this.catalog.cards({ ratingCount: { gte: 1 } }, [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }], limit, user?.id) });
          break;
        case 'CUSTOM_PRODUCTS':
          resolvedSections.push({ ...base, products: await this.catalog.cardsByIds((config.productIds as string[]) ?? [], user?.id) });
          break;
        case 'FEATURED_CATEGORIES': {
          const categories = await this.prisma.category.findMany({
            where: { isActive: true, deletedAt: null, isFeatured: true },
            orderBy: { sortOrder: 'asc' },
            take: limit,
            select: { id: true, name: true, slug: true, imageUrl: true, iconName: true },
          });
          resolvedSections.push({ ...base, categories });
          break;
        }
        case 'FEATURED_BRANDS': {
          const brands = await this.prisma.brand.findMany({
            where: { isActive: true, deletedAt: null, isFeatured: true },
            take: limit,
            select: { id: true, name: true, slug: true, logoUrl: true },
          });
          resolvedSections.push({ ...base, brands });
          break;
        }
        case 'RECENTLY_VIEWED': {
          if (!user) break;
          const rows = await this.prisma.recentlyViewed.findMany({
            where: { userId: user.id },
            orderBy: { viewedAt: 'desc' },
            take: limit,
          });
          const products = await this.catalog.cardsByIds(rows.map((r) => r.productId), user.id);
          if (products.length) resolvedSections.push({ ...base, products });
          break;
        }
      }
    }

    return {
      banners: {
        hero: banners.filter((b) => b.placement === 'HERO').map(this.toBanner),
        promo: banners.filter((b) => b.placement === 'PROMO').map(this.toBanner),
        strip: banners.filter((b) => b.placement === 'STRIP').map(this.toBanner),
      },
      sections: resolvedSections,
    };
  }

  private toBanner = (b: any) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    linkUrl: b.linkUrl,
  });
}
