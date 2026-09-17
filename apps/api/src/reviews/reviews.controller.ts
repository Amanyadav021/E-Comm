import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { reviewSchema } from '@shopcraft/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dec, validate } from '../common/utils';
import { Public, CurrentUser, AuthUser } from '../auth/decorators';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Public: paginated approved reviews for a product. */
  @Public()
  @Get('product/:productId')
  async forProduct(@Param('productId') productId: string, @Query('page') page = '1') {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = 10;
    const where = { productId, status: 'APPROVED', deletedAt: null };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true } }, images: true },
      }),
    ]);
    return {
      total,
      page: p,
      pageSize,
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        author: r.user.name,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        images: r.images.map((i) => i.url),
      })),
    };
  }

  /** Create/update the signed-in user's review. Verified badge requires a delivered purchase. */
  @Post()
  async upsert(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(reviewSchema, body);

    const purchasedItem = await this.prisma.orderItem.findFirst({
      where: { productId: dto.productId, order: { userId: user.id, status: 'DELIVERED' } },
      orderBy: { id: 'desc' },
    });
    const anyPurchase = purchasedItem
      ? true
      : (await this.prisma.orderItem.count({
          where: {
            productId: dto.productId,
            order: { userId: user.id, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'] } },
          },
        })) > 0;
    if (!anyPurchase) {
      throw new BadRequestException('You can review a product after purchasing it.');
    }

    const review = await this.prisma.review.upsert({
      where: { userId_productId: { userId: user.id, productId: dto.productId } },
      create: {
        userId: user.id,
        productId: dto.productId,
        orderItemId: purchasedItem?.id ?? null,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        isVerified: !!purchasedItem,
        status: 'PENDING',
      },
      update: { rating: dto.rating, title: dto.title, body: dto.body, status: 'PENDING', deletedAt: null },
    });

    await this.recomputeProductRating(dto.productId);
    await this.notifications.notifyAdmins({
      type: 'NEW_REVIEW',
      title: 'New review awaiting moderation',
      body: `${user.name} rated a product ${dto.rating}/5.`,
      data: { reviewId: review.id, productId: dto.productId },
    });
    return { id: review.id, status: review.status };
  }

  @Get('mine')
  async mine(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.review.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true, slug: true, images: { take: 1, orderBy: [{ isPrimary: 'desc' }] } } } },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt,
      product: { name: r.product.name, slug: r.product.slug, image: r.product.images[0]?.url ?? null },
    }));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const review = await this.prisma.review.findFirst({ where: { id, userId: user.id } });
    if (!review) throw new BadRequestException('Review not found');
    await this.prisma.review.update({ where: { id }, data: { deletedAt: new Date(), status: 'HIDDEN' } });
    await this.recomputeProductRating(review.productId);
    return { ok: true };
  }

  /** Ratings roll up from APPROVED + PENDING (pending shows author's rating immediately; moderation can hide). */
  private async recomputeProductRating(productId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { productId, status: { in: ['APPROVED', 'PENDING'] }, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        ratingCount: agg._count._all,
        reviewCount: agg._count._all,
      },
    });
  }
}
