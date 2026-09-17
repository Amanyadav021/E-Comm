import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CatalogService } from '../catalog/catalog.service';
import { dec, validate } from '../common/utils';
import { CurrentUser, AuthUser } from '../auth/decorators';

const addSchema = z.object({ productId: z.string().min(1) });

@Controller('wishlist')
export class WishlistController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const cards = await this.catalog.cardsByIds(rows.map((r) => r.productId), user.id);
    const priceAtAdd = new Map(rows.map((r) => [r.productId, dec(r.priceAtAdd)]));
    return cards.map((c) => ({
      ...c,
      priceAtAdd: priceAtAdd.get(c.id) ?? c.price,
      priceDropped: (priceAtAdd.get(c.id) ?? c.price) > c.price,
    }));
  }

  @Post()
  async add(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(addSchema, body);
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, status: 'ACTIVE', deletedAt: null },
    });
    if (!product) throw new BadRequestException('This product is no longer available.');
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId: dto.productId } },
      create: { userId: user.id, productId: dto.productId, priceAtAdd: product.minPrice },
      update: {},
    });
    await this.prisma.product.update({
      where: { id: dto.productId },
      data: { wishlistCount: { increment: 1 } },
    }).catch(() => undefined);
    return { ok: true };
  }

  @Delete(':productId')
  async remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
    return { ok: true };
  }

  /** Move a wishlist product (its default variant) into the cart. */
  @Post(':productId/move-to-cart')
  async moveToCart(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { productId, isActive: true, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!variant) throw new BadRequestException('This product is no longer available.');
    await this.cart.addItem(user.id, variant.id, 1);
    await this.prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
    return { ok: true };
  }
}
