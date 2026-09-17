import { Body, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { stockAdjustSchema } from '@shopcraft/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../common/audit.service';
import { dec, toCsv, validate } from '../common/utils';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.enum(['all', 'low', 'out']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller('admin/inventory')
export class InventoryAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  @RequirePerms('inventory.read')
  @Get()
  async list(@Query() query: unknown) {
    const dto = validate(listSchema, query);
    const where: Prisma.ProductVariantWhereInput = { deletedAt: null, product: { deletedAt: null } };
    if (dto.q) {
      where.OR = [{ sku: { contains: dto.q } }, { product: { name: { contains: dto.q } } }];
    }
    if (dto.filter === 'out') where.stockOnHand = { lte: 0 };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.findMany({
        where,
        orderBy: dto.filter === 'all' ? { updatedAt: 'desc' } : { stockOnHand: 'asc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        include: {
          product: {
            select: {
              name: true, status: true,
              images: { orderBy: [{ isPrimary: 'desc' }], take: 1, select: { url: true } },
            },
          },
        },
      }),
    ]);

    let items = rows.map((v) => ({
      variantId: v.id,
      productName: v.product.name,
      productStatus: v.product.status,
      image: v.product.images[0]?.url ?? null,
      sku: v.sku,
      variantName: v.name,
      stockOnHand: v.stockOnHand,
      stockReserved: v.stockReserved,
      available: v.stockOnHand - v.stockReserved,
      lowStockThreshold: v.lowStockThreshold,
      status: v.stockOnHand <= 0 ? 'OUT' : v.stockOnHand <= v.lowStockThreshold ? 'LOW' : 'OK',
      price: dec(v.price),
    }));
    if (dto.filter === 'low') items = items.filter((i) => i.status === 'LOW');
    return { total, page: dto.page, pageSize: dto.pageSize, items };
  }

  @RequirePerms('inventory.write')
  @HttpCode(200)
  @Post('adjust')
  async adjust(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(stockAdjustSchema, body);
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.adjust(tx, dto.variantId, dto.qty, dto.type, user.id, dto.reason);
    });
    await this.audit.log({
      actorId: user.id, action: 'inventory.adjust', entity: 'ProductVariant', entityId: dto.variantId,
      metadata: { qty: dto.qty, type: dto.type, reason: dto.reason },
    });
    const variant = await this.prisma.productVariant.findUniqueOrThrow({ where: { id: dto.variantId } });
    return { stockOnHand: variant.stockOnHand, stockReserved: variant.stockReserved };
  }

  @RequirePerms('inventory.read')
  @Get('history/:variantId')
  async history(@Param('variantId') variantId: string, @Query('page') page = '1') {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = 25;
    const where = { variantId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { name: true } } },
      }),
    ]);
    return {
      total, page: p, pageSize,
      items: rows.map((t) => ({
        id: t.id, type: t.type, qty: t.qty, balanceAfter: t.balanceAfter,
        reason: t.reason, orderId: t.orderId, by: t.actor?.name ?? 'System', at: t.createdAt,
      })),
    };
  }

  @RequirePerms('inventory.read')
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventory.csv"')
  async export() {
    const rows = await this.prisma.productVariant.findMany({
      where: { deletedAt: null, product: { deletedAt: null } },
      include: { product: { select: { name: true } } },
      orderBy: { sku: 'asc' },
      take: 10_000,
    });
    return toCsv(
      ['SKU', 'Product', 'Variant', 'On Hand', 'Reserved', 'Available', 'Low Stock Threshold', 'Price', 'MRP'],
      rows.map((v) => [
        v.sku, v.product.name, v.name ?? '', v.stockOnHand, v.stockReserved,
        v.stockOnHand - v.stockReserved, v.lowStockThreshold, dec(v.price), dec(v.mrp),
      ]),
    );
  }
}
