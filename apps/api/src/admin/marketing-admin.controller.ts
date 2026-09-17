import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  couponInputSchema,
  offerInputSchema,
  bannerInputSchema,
  homeSectionInputSchema,
  type CouponInputDto,
  type OfferInputDto,
} from '@shopcraft/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../common/audit.service';
import { dec, toJson, validate } from '../common/utils';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

@Controller('admin/marketing')
export class MarketingAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
  ) {}

  // ================= Coupons =================

  @RequirePerms('marketing.read')
  @Get('coupons')
  async coupons() {
    const rows = await this.prisma.coupon.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    return rows.map((c) => ({
      id: c.id, code: c.code, description: c.description, type: c.type, value: dec(c.value),
      minOrderAmount: dec(c.minOrderAmount), maxDiscount: c.maxDiscount == null ? null : dec(c.maxDiscount),
      startsAt: c.startsAt, endsAt: c.endsAt, usageLimit: c.usageLimit, perUserLimit: c.perUserLimit,
      usedCount: c.usedCount, firstOrderOnly: c.firstOrderOnly, appliesTo: c.appliesTo, isActive: c.isActive,
      redemptionCount: c._count.redemptions,
    }));
  }

  @RequirePerms('marketing.write')
  @Post('coupons')
  async createCoupon(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(couponInputSchema, body);
    const exists = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (exists) throw new BadRequestException(`Coupon code ${dto.code} already exists.`);
    const coupon = await this.prisma.coupon.create({ data: this.couponData(dto) });
    await this.syncScope('coupon', coupon.id, dto);
    await this.audit.log({ actorId: user.id, action: 'coupon.create', entity: 'Coupon', entityId: coupon.id, metadata: { code: dto.code } });
    return coupon;
  }

  @RequirePerms('marketing.write')
  @Put('coupons/:id')
  async updateCoupon(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(couponInputSchema, body);
    const coupon = await this.prisma.coupon.update({ where: { id }, data: this.couponData(dto) });
    await this.syncScope('coupon', id, dto);
    await this.audit.log({ actorId: user.id, action: 'coupon.update', entity: 'Coupon', entityId: id, metadata: { code: dto.code } });
    return coupon;
  }

  @RequirePerms('marketing.write')
  @Delete('coupons/:id')
  async deleteCoupon(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.prisma.coupon.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit.log({ actorId: user.id, action: 'coupon.delete', entity: 'Coupon', entityId: id });
    return { ok: true };
  }

  @RequirePerms('marketing.read')
  @Get('coupons/:id/usage')
  async couponUsage(@Param('id') id: string) {
    const rows = await this.prisma.couponRedemption.findMany({
      where: { couponId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true } }, order: { select: { orderNumber: true, total: true } } },
    });
    return rows.map((r) => ({
      customer: r.user.name, orderNumber: r.order.orderNumber,
      orderTotal: dec(r.order.total), discount: dec(r.amount), at: r.createdAt,
    }));
  }

  private couponData(dto: CouponInputDto) {
    return {
      code: dto.code, description: dto.description, type: dto.type, value: dto.value,
      minOrderAmount: dto.minOrderAmount, maxDiscount: dto.maxDiscount,
      startsAt: dto.startsAt, endsAt: dto.endsAt, usageLimit: dto.usageLimit,
      perUserLimit: dto.perUserLimit, firstOrderOnly: dto.firstOrderOnly,
      appliesTo: dto.appliesTo, isActive: dto.isActive,
    };
  }

  // ================= Offers =================

  @RequirePerms('marketing.read')
  @Get('offers')
  async offers() {
    const rows = await this.prisma.offer.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { products: true, categories: true },
    });
    return rows.map((o) => ({
      id: o.id, title: o.title, badgeText: o.badgeText, type: o.type, value: dec(o.value),
      maxDiscount: o.maxDiscount == null ? null : dec(o.maxDiscount), appliesTo: o.appliesTo,
      priority: o.priority, startsAt: o.startsAt, endsAt: o.endsAt, isFlashSale: o.isFlashSale,
      isActive: o.isActive, productIds: o.products.map((p) => p.productId), categoryIds: o.categories.map((c) => c.categoryId),
    }));
  }

  @RequirePerms('marketing.write')
  @Post('offers')
  async createOffer(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(offerInputSchema, body);
    const offer = await this.prisma.offer.create({ data: this.offerData(dto) });
    await this.syncScope('offer', offer.id, dto);
    this.pricing.invalidateOffersCache();
    await this.audit.log({ actorId: user.id, action: 'offer.create', entity: 'Offer', entityId: offer.id, metadata: { title: dto.title } });
    return offer;
  }

  @RequirePerms('marketing.write')
  @Put('offers/:id')
  async updateOffer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(offerInputSchema, body);
    const offer = await this.prisma.offer.update({ where: { id }, data: this.offerData(dto) });
    await this.syncScope('offer', id, dto);
    this.pricing.invalidateOffersCache();
    await this.audit.log({ actorId: user.id, action: 'offer.update', entity: 'Offer', entityId: id, metadata: { title: dto.title } });
    return offer;
  }

  @RequirePerms('marketing.write')
  @Delete('offers/:id')
  async deleteOffer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.prisma.offer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    this.pricing.invalidateOffersCache();
    await this.audit.log({ actorId: user.id, action: 'offer.delete', entity: 'Offer', entityId: id });
    return { ok: true };
  }

  private offerData(dto: OfferInputDto) {
    return {
      title: dto.title, badgeText: dto.badgeText, type: dto.type, value: dto.value,
      maxDiscount: dto.maxDiscount, appliesTo: dto.appliesTo, priority: dto.priority,
      startsAt: dto.startsAt, endsAt: dto.endsAt, isFlashSale: dto.isFlashSale, isActive: dto.isActive,
    };
  }

  private async syncScope(kind: 'coupon' | 'offer', id: string, dto: { appliesTo: string; productIds?: string[]; categoryIds?: string[] }) {
    if (kind === 'coupon') {
      await this.prisma.couponProduct.deleteMany({ where: { couponId: id } });
      await this.prisma.couponCategory.deleteMany({ where: { couponId: id } });
      if (dto.appliesTo === 'PRODUCT' && dto.productIds?.length) {
        await this.prisma.couponProduct.createMany({ data: dto.productIds.map((productId) => ({ couponId: id, productId })) });
      }
      if (dto.appliesTo === 'CATEGORY' && dto.categoryIds?.length) {
        await this.prisma.couponCategory.createMany({ data: dto.categoryIds.map((categoryId) => ({ couponId: id, categoryId })) });
      }
    } else {
      await this.prisma.offerProduct.deleteMany({ where: { offerId: id } });
      await this.prisma.offerCategory.deleteMany({ where: { offerId: id } });
      if (dto.appliesTo === 'PRODUCT' && dto.productIds?.length) {
        await this.prisma.offerProduct.createMany({ data: dto.productIds.map((productId) => ({ offerId: id, productId })) });
      }
      if (dto.appliesTo === 'CATEGORY' && dto.categoryIds?.length) {
        await this.prisma.offerCategory.createMany({ data: dto.categoryIds.map((categoryId) => ({ offerId: id, categoryId })) });
      }
    }
  }

  // ================= Banners =================

  @RequirePerms('content.read')
  @Get('banners')
  banners() {
    return this.prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] });
  }

  @RequirePerms('content.write')
  @Post('banners')
  async createBanner(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(bannerInputSchema, body);
    const banner = await this.prisma.banner.create({ data: dto });
    await this.audit.log({ actorId: user.id, action: 'banner.create', entity: 'Banner', entityId: banner.id });
    return banner;
  }

  @RequirePerms('content.write')
  @Put('banners/:id')
  async updateBanner(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(bannerInputSchema, body);
    const banner = await this.prisma.banner.update({ where: { id }, data: dto });
    await this.audit.log({ actorId: user.id, action: 'banner.update', entity: 'Banner', entityId: id });
    return banner;
  }

  @RequirePerms('content.write')
  @Delete('banners/:id')
  async deleteBanner(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.prisma.banner.delete({ where: { id } });
    await this.audit.log({ actorId: user.id, action: 'banner.delete', entity: 'Banner', entityId: id });
    return { ok: true };
  }

  // ================= Homepage sections =================

  @RequirePerms('content.read')
  @Get('home-sections')
  homeSections() {
    return this.prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @RequirePerms('content.write')
  @Post('home-sections')
  async createSection(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(homeSectionInputSchema, body);
    const exists = await this.prisma.homeSection.findUnique({ where: { key: dto.key } });
    if (exists) throw new BadRequestException(`A section with key "${dto.key}" already exists.`);
    const section = await this.prisma.homeSection.create({
      data: { ...dto, config: dto.config ? toJson(dto.config) : null },
    });
    await this.audit.log({ actorId: user.id, action: 'home_section.create', entity: 'HomeSection', entityId: section.id });
    return section;
  }

  @RequirePerms('content.write')
  @Put('home-sections/:id')
  async updateSection(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(homeSectionInputSchema, body);
    const section = await this.prisma.homeSection.update({
      where: { id },
      data: { ...dto, config: dto.config ? toJson(dto.config) : null },
    });
    await this.audit.log({ actorId: user.id, action: 'home_section.update', entity: 'HomeSection', entityId: id });
    return section;
  }

  @RequirePerms('content.write')
  @Delete('home-sections/:id')
  async deleteSection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.prisma.homeSection.delete({ where: { id } });
    await this.audit.log({ actorId: user.id, action: 'home_section.delete', entity: 'HomeSection', entityId: id });
    return { ok: true };
  }

  // ================= Abandoned carts =================

  @RequirePerms('marketing.read')
  @Get('abandoned-carts')
  async abandonedCarts(@Query('page') page = '1') {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = 20;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where: Prisma.CartWhereInput = {
      status: 'ACTIVE',
      lastActivityAt: { lte: cutoff },
      items: { some: {} },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.cart.count({ where }),
      this.prisma.cart.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        skip: (p - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          items: { include: { variant: { include: { product: { select: { name: true } } } } } },
        },
      }),
    ]);
    return {
      total, page: p, pageSize,
      items: rows.map((c) => ({
        id: c.id,
        customer: c.user.name,
        contact: c.user.email ?? c.user.phone,
        lastActivityAt: c.lastActivityAt,
        createdAt: c.createdAt,
        cartValue: c.items.reduce((s, i) => s + dec(i.variant.price) * i.qty, 0),
        items: c.items.map((i) => ({ name: i.variant.product.name, qty: i.qty, price: dec(i.variant.price) })),
      })),
    };
  }
}
