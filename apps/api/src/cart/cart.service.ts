import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { dec, fromJson } from '../common/utils';
import { MAX_CART_QTY_PER_ITEM, type PricingLineInput } from '@shopcraft/shared';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  private async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart || cart.status !== 'ACTIVE') {
      if (cart) {
        cart = await this.prisma.cart.update({
          where: { userId },
          data: { status: 'ACTIVE', couponCode: null, lastActivityAt: new Date() },
        });
        await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      } else {
        cart = await this.prisma.cart.create({ data: { userId } });
      }
    }
    return cart;
  }

  private touch(cartId: string) {
    return this.prisma.cart.update({ where: { id: cartId }, data: { lastActivityAt: new Date() } });
  }

  /** Full cart with server-computed pricing. `pincode` refines the shipping estimate. */
  async getCart(userId: string, pincode?: string) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true, name: true, slug: true, categoryId: true, status: true, deletedAt: true,
                taxRatePct: true, codAvailable: true,
                images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    });

    const validItems = items.filter(
      (i) => i.variant.isActive && !i.variant.deletedAt && i.variant.product.status === 'ACTIVE' && !i.variant.product.deletedAt,
    );

    const lines: PricingLineInput[] = validItems.map((i) => ({
      variantId: i.variantId,
      productId: i.variant.product.id,
      categoryId: i.variant.product.categoryId,
      qty: i.qty,
      mrp: dec(i.variant.mrp),
      price: dec(i.variant.price),
      taxRatePct: dec(i.variant.product.taxRatePct),
    }));

    const pricing = await this.pricing.priceLines({
      lines,
      couponCode: cart.couponCode,
      userId,
      pincode,
    });

    const pricedByVariant = new Map(pricing.lines.map((l) => [l.variantId, l]));

    return {
      id: cart.id,
      couponCode: pricing.couponError ? null : cart.couponCode,
      couponError: pricing.couponError,
      items: validItems.map((i) => {
        const available = i.variant.stockOnHand - i.variant.stockReserved;
        const priced = pricedByVariant.get(i.variantId)!;
        return {
          id: i.id,
          variantId: i.variantId,
          productId: i.variant.product.id,
          slug: i.variant.product.slug,
          name: i.variant.product.name,
          image: i.variant.product.images[0]?.url ?? null,
          options: fromJson<Record<string, string>>(i.variant.options, {}),
          qty: i.qty,
          maxQty: Math.min(MAX_CART_QTY_PER_ITEM, Math.max(0, available)),
          mrp: priced.mrp,
          price: priced.effectiveUnitPrice,
          offerBadge: priced.offerBadge,
          lineTotal: priced.lineTotal,
          inStock: available > 0,
          insufficientStock: available < i.qty,
          codAvailable: i.variant.product.codAvailable,
        };
      }),
      summary: {
        subtotal: pricing.subtotal,
        productDiscount: pricing.productDiscount,
        offerDiscount: pricing.offerDiscount,
        couponDiscount: pricing.couponDiscount,
        shippingFee: pricing.shippingFee,
        taxAmount: pricing.taxAmount,
        total: pricing.total,
        itemCount: validItems.reduce((s, i) => s + i.qty, 0),
        freeShippingAbove: pricing.zone?.freeAbove == null ? null : dec(pricing.zone.freeAbove),
      },
    };
  }

  async addItem(userId: string, variantId: string, qty: number) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isActive: true, deletedAt: null, product: { status: 'ACTIVE', deletedAt: null } },
    });
    if (!variant) throw new NotFoundException('This product is no longer available.');
    const available = variant.stockOnHand - variant.stockReserved;
    if (available <= 0) throw new BadRequestException('This item is out of stock.');

    const cart = await this.getOrCreateCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const newQty = Math.min((existing?.qty ?? 0) + qty, MAX_CART_QTY_PER_ITEM, available);
    if (existing) {
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { qty: newQty } });
    } else {
      await this.prisma.cartItem.create({ data: { cartId: cart.id, variantId, qty: Math.min(qty, newQty) } });
    }
    await this.touch(cart.id);
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, qty: number) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id }, include: { variant: true } });
    if (!item) throw new NotFoundException('Cart item not found');
    if (qty <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      const available = item.variant.stockOnHand - item.variant.stockReserved;
      const capped = Math.min(qty, MAX_CART_QTY_PER_ITEM, Math.max(1, available));
      await this.prisma.cartItem.update({ where: { id: item.id }, data: { qty: capped } });
    }
    await this.touch(cart.id);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    await this.touch(cart.id);
    return this.getCart(userId);
  }

  async applyCoupon(userId: string, code: string) {
    const cart = await this.getOrCreateCart(userId);
    const check = await this.pricing.checkCoupon(code, userId);
    if (check.error) throw new BadRequestException(check.error);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code.toUpperCase(), lastActivityAt: new Date() } });
    const result = await this.getCart(userId);
    if (result.couponError) {
      await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
      throw new BadRequestException(result.couponError);
    }
    return result;
  }

  async removeCoupon(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null, lastActivityAt: new Date() } });
    return this.getCart(userId);
  }
}
