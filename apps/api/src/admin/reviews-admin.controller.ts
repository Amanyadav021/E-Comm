import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { validate } from '../common/utils';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

const listSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'HIDDEN']).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const moderateSchema = z.object({ status: z.enum(['APPROVED', 'HIDDEN']) });

@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @RequirePerms('reviews.read')
  @Get()
  async list(@Query() query: unknown) {
    const dto = validate(listSchema, query);
    const where: Prisma.ReviewWhereInput = { deletedAt: null };
    if (dto.status) where.status = dto.status;
    if (dto.rating) where.rating = dto.rating;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        include: {
          user: { select: { name: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);
    return {
      total, page: dto.page, pageSize: dto.pageSize,
      items: rows.map((r) => ({
        id: r.id, rating: r.rating, title: r.title, body: r.body, status: r.status,
        isVerified: r.isVerified, author: r.user.name, product: r.product, createdAt: r.createdAt,
      })),
    };
  }

  @RequirePerms('reviews.write')
  @Patch(':id/moderate')
  async moderate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(moderateSchema, body);
    const review = await this.prisma.review.update({ where: { id }, data: { status: dto.status } });
    await this.recompute(review.productId);
    await this.audit.log({ actorId: user.id, action: 'review.moderate', entity: 'Review', entityId: id, metadata: { status: dto.status } });
    return { ok: true };
  }

  @RequirePerms('reviews.write')
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const review = await this.prisma.review.update({ where: { id }, data: { deletedAt: new Date(), status: 'HIDDEN' } });
    await this.recompute(review.productId);
    await this.audit.log({ actorId: user.id, action: 'review.delete', entity: 'Review', entityId: id });
    return { ok: true };
  }

  private async recompute(productId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { productId, status: { in: ['APPROVED', 'PENDING'] }, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all, reviewCount: agg._count._all },
    });
  }
}
