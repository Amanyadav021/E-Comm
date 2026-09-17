import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { PricingService } from '../pricing/pricing.service';
import { dec, fromJson, slugify, toJson } from '../common/utils';
import { discountPct, type ProductInput } from '@shopcraft/shared';

@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
  ) {}

  // ================= Products =================

  async listProducts(query: {
    q?: string; categoryId?: string; brandId?: string; status?: string;
    stock?: 'low' | 'out'; page: number; pageSize: number;
  }) {
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (query.q) {
      where.OR = [{ name: { contains: query.q } }, { sku: { contains: query.q } }, { slug: { contains: query.q } }];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.status) where.status = query.status;
    if (query.stock === 'out') {
      where.variants = { every: { stockOnHand: { lte: 0 } } };
    } else if (query.stock === 'low') {
      where.variants = { some: { stockOnHand: { gt: 0 } } };
      // refined below after fetch (threshold is per-variant)
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
          variants: { where: { deletedAt: null } },
        },
      }),
    ]);

    let items = rows.map((p) => {
      const totalStock = p.variants.reduce((s, v) => s + v.stockOnHand, 0);
      const lowStock = p.variants.some((v) => v.stockOnHand > 0 && v.stockOnHand <= v.lowStockThreshold);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        image: p.images[0]?.url ?? null,
        category: p.category.name,
        brand: p.brand?.name ?? null,
        status: p.status,
        isFeatured: p.isFeatured,
        minPrice: dec(p.minPrice),
        maxMrp: dec(p.maxMrp),
        discountPct: p.discountPct,
        totalStock,
        lowStock,
        outOfStock: totalStock <= 0,
        variantCount: p.variants.length,
        soldCount: p.soldCount,
        ratingAvg: dec(p.ratingAvg),
        updatedAt: p.updatedAt,
      };
    });
    if (query.stock === 'low') items = items.filter((i) => i.lowStock);
    return { total, page: query.page, pageSize: query.pageSize, items };
  }

  async getProduct(id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Product not found');
    return {
      ...p,
      taxRatePct: dec(p.taxRatePct),
      minPrice: dec(p.minPrice),
      maxMrp: dec(p.maxMrp),
      ratingAvg: dec(p.ratingAvg),
      specifications: fromJson(p.specifications, []),
      features: fromJson(p.features, []),
      optionTypes: fromJson(p.optionTypes, []),
      variants: p.variants.map((v) => ({
        ...v,
        mrp: dec(v.mrp),
        price: dec(v.price),
        costPrice: v.costPrice == null ? null : dec(v.costPrice),
        options: fromJson(v.options, {}),
      })),
    };
  }

  async createProduct(input: ProductInput, actorId: string) {
    const slug = await this.uniqueSlug(input.slug || slugify(input.name));
    await this.assertSkuFree(input.sku);
    const { variants, ...fields } = input;
    this.assertSingleDefault(variants);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...this.productData(fields),
          slug,
          publishedAt: input.status === 'ACTIVE' ? new Date() : null,
          ...this.priceAggregates(variants),
        },
      });
      for (const [idx, v] of variants.entries()) {
        const variant = await tx.productVariant.create({
          data: this.variantData(created.id, v, idx === 0 && !variants.some((x) => x.isDefault)),
        });
        await tx.priceHistory.create({
          data: { variantId: variant.id, mrp: v.mrp, price: v.price, changedById: actorId },
        });
        if (v.stockOnHand > 0) {
          await tx.inventoryTransaction.create({
            data: { variantId: variant.id, type: 'RESTOCK', qty: v.stockOnHand, balanceAfter: v.stockOnHand, actorId, reason: 'Initial stock' },
          });
        }
      }
      return created;
    });

    await this.audit.log({ actorId, action: 'product.create', entity: 'Product', entityId: product.id, metadata: { name: input.name, sku: input.sku } });
    return this.getProduct(product.id);
  }

  async updateProduct(id: string, input: ProductInput, actorId: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });
    if (!existing) throw new NotFoundException('Product not found');
    if (input.sku !== existing.sku) await this.assertSkuFree(input.sku);
    const slug = input.slug && input.slug !== existing.slug ? await this.uniqueSlug(input.slug) : existing.slug;
    const { variants, ...fields } = input;
    this.assertSingleDefault(variants);

    const changes: Record<string, unknown> = {};
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...this.productData(fields),
          slug,
          publishedAt: input.status === 'ACTIVE' && !existing.publishedAt ? new Date() : existing.publishedAt,
          ...this.priceAggregates(variants),
        },
      });

      const existingIds = new Set(existing.variants.map((v) => v.id));
      const inputIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));

      // Soft-delete variants removed in the editor (order history stays intact)
      for (const v of existing.variants) {
        if (!inputIds.has(v.id)) {
          await tx.productVariant.update({ where: { id: v.id }, data: { deletedAt: new Date(), isActive: false } });
          changes[`variant:${v.sku}`] = 'removed';
        }
      }

      for (const [idx, v] of variants.entries()) {
        if (v.id && existingIds.has(v.id)) {
          const before = existing.variants.find((x) => x.id === v.id)!;
          // Stock is managed exclusively through inventory adjustments
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              sku: v.sku,
              name: v.name,
              options: v.options ? toJson(v.options) : null,
              mrp: v.mrp,
              price: v.price,
              costPrice: v.costPrice,
              weightGrams: v.weightGrams,
              dimensions: v.dimensions,
              lowStockThreshold: v.lowStockThreshold,
              isDefault: v.isDefault,
              isActive: v.isActive,
            },
          });
          if (dec(before.price) !== v.price || dec(before.mrp) !== v.mrp) {
            await tx.priceHistory.create({
              data: { variantId: v.id, mrp: v.mrp, price: v.price, changedById: actorId },
            });
            changes[`price:${v.sku}`] = { from: dec(before.price), to: v.price };
          }
        } else {
          const variant = await tx.productVariant.create({
            data: this.variantData(id, v, false),
          });
          await tx.priceHistory.create({
            data: { variantId: variant.id, mrp: v.mrp, price: v.price, changedById: actorId },
          });
          if (v.stockOnHand > 0) {
            await tx.inventoryTransaction.create({
              data: { variantId: variant.id, type: 'RESTOCK', qty: v.stockOnHand, balanceAfter: v.stockOnHand, actorId, reason: 'Initial stock' },
            });
          }
          changes[`variant:${v.sku}`] = 'added';
        }
      }
    });

    await this.audit.log({ actorId, action: 'product.update', entity: 'Product', entityId: id, metadata: changes });
    return this.getProduct(id);
  }

  async setProductStatus(id: string, status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED', actorId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({
      where: { id },
      data: { status, publishedAt: status === 'ACTIVE' && !product.publishedAt ? new Date() : product.publishedAt },
    });
    await this.audit.log({ actorId, action: 'product.status', entity: 'Product', entityId: id, metadata: { from: product.status, to: status } });
    return { ok: true };
  }

  async deleteProduct(id: string, actorId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await this.prisma.productVariant.updateMany({ where: { productId: id }, data: { isActive: false } });
    await this.audit.log({ actorId, action: 'product.delete', entity: 'Product', entityId: id, metadata: { name: product.name } });
    return { ok: true };
  }

  async duplicateProduct(id: string, actorId: string) {
    const source = await this.getProduct(id);
    const copyInput: ProductInput = {
      name: `${source.name} (Copy)`,
      sku: `${source.sku}-COPY-${Date.now().toString(36).toUpperCase()}`,
      categoryId: source.categoryId,
      brandId: source.brandId,
      description: source.description,
      shortDescription: source.shortDescription,
      specifications: source.specifications as any,
      features: source.features as any,
      optionTypes: source.optionTypes as any,
      warranty: source.warranty,
      returnPolicy: source.returnPolicy,
      returnWindowDays: source.returnWindowDays,
      isReturnable: source.isReturnable,
      codAvailable: source.codAvailable,
      taxRatePct: source.taxRatePct,
      status: 'DRAFT',
      isFeatured: false,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      seoKeywords: source.seoKeywords,
      variants: source.variants.map((v: any, i: number) => ({
        sku: `${v.sku}-C${i}${Date.now().toString(36).slice(-3).toUpperCase()}`,
        name: v.name,
        options: v.options,
        mrp: v.mrp,
        price: v.price,
        costPrice: v.costPrice,
        weightGrams: v.weightGrams,
        dimensions: v.dimensions,
        stockOnHand: 0,
        lowStockThreshold: v.lowStockThreshold,
        isDefault: v.isDefault,
        isActive: true,
      })),
    };
    return this.createProduct(copyInput, actorId);
  }

  async priceHistory(variantId: string) {
    const rows = await this.prisma.priceHistory.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({ mrp: dec(r.mrp), price: dec(r.price), at: r.createdAt, by: r.changedById }));
  }

  // ---------- Product images ----------

  async addImage(productId: string, input: { url: string; alt?: string; variantId?: string }, actorId: string) {
    await this.assertProduct(productId);
    const count = await this.prisma.productImage.count({ where: { productId } });
    const image = await this.prisma.productImage.create({
      data: { productId, url: input.url, alt: input.alt, variantId: input.variantId ?? null, sortOrder: count, isPrimary: count === 0 },
    });
    await this.audit.log({ actorId, action: 'product.image_add', entity: 'Product', entityId: productId });
    return image;
  }

  async reorderImages(productId: string, order: Array<{ id: string; sortOrder: number; isPrimary?: boolean }>, actorId: string) {
    await this.assertProduct(productId);
    await this.prisma.$transaction(
      order.map((o) =>
        this.prisma.productImage.update({
          where: { id: o.id },
          data: { sortOrder: o.sortOrder, isPrimary: !!o.isPrimary },
        }),
      ),
    );
    await this.audit.log({ actorId, action: 'product.image_reorder', entity: 'Product', entityId: productId });
    return { ok: true };
  }

  async deleteImage(productId: string, imageId: string, actorId: string) {
    await this.prisma.productImage.deleteMany({ where: { id: imageId, productId } });
    await this.audit.log({ actorId, action: 'product.image_delete', entity: 'Product', entityId: productId });
    return { ok: true };
  }

  // ================= Categories =================

  async listCategories() {
    const rows = await this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return rows.map((c) => ({
      id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, imageUrl: c.imageUrl,
      iconName: c.iconName, sortOrder: c.sortOrder, isActive: c.isActive, isFeatured: c.isFeatured,
      productCount: c._count.products,
    }));
  }

  async upsertCategory(id: string | null, input: any, actorId: string) {
    const slug = input.slug || slugify(input.name);
    if (input.parentId) {
      const parent = await this.prisma.category.findFirst({ where: { id: input.parentId, deletedAt: null } });
      if (!parent) throw new BadRequestException('Parent category not found');
      if (id && input.parentId === id) throw new BadRequestException('A category cannot be its own parent');
    }
    const data = {
      name: input.name, slug, parentId: input.parentId ?? null, imageUrl: input.imageUrl,
      iconName: input.iconName, sortOrder: input.sortOrder, isActive: input.isActive, isFeatured: input.isFeatured,
    };
    const category = id
      ? await this.prisma.category.update({ where: { id }, data })
      : await this.prisma.category.create({ data });
    await this.audit.log({ actorId, action: id ? 'category.update' : 'category.create', entity: 'Category', entityId: category.id, metadata: { name: input.name } });
    return category;
  }

  async deleteCategory(id: string, actorId: string) {
    const [products, children] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { categoryId: id, deletedAt: null } }),
      this.prisma.category.count({ where: { parentId: id, deletedAt: null } }),
    ]);
    if (products > 0) throw new BadRequestException(`Cannot delete: ${products} product(s) use this category. Move them first.`);
    if (children > 0) throw new BadRequestException(`Cannot delete: this category has ${children} subcategor(ies).`);
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit.log({ actorId, action: 'category.delete', entity: 'Category', entityId: id });
    return { ok: true };
  }

  // ================= Brands =================

  async listBrands() {
    const rows = await this.prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return rows.map((b) => ({ ...b, productCount: b._count.products, _count: undefined }));
  }

  async upsertBrand(id: string | null, input: any, actorId: string) {
    const slug = input.slug || slugify(input.name);
    const data = { name: input.name, slug, logoUrl: input.logoUrl, isActive: input.isActive, isFeatured: input.isFeatured };
    try {
      const brand = id
        ? await this.prisma.brand.update({ where: { id }, data })
        : await this.prisma.brand.create({ data });
      await this.audit.log({ actorId, action: id ? 'brand.update' : 'brand.create', entity: 'Brand', entityId: brand.id, metadata: { name: input.name } });
      return brand;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A brand with this name already exists.');
      }
      throw err;
    }
  }

  async deleteBrand(id: string, actorId: string) {
    const products = await this.prisma.product.count({ where: { brandId: id, deletedAt: null } });
    if (products > 0) throw new BadRequestException(`Cannot delete: ${products} product(s) use this brand.`);
    await this.prisma.brand.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit.log({ actorId, action: 'brand.delete', entity: 'Brand', entityId: id });
    return { ok: true };
  }

  // ================= Helpers =================

  private productData(fields: Omit<ProductInput, 'variants' | 'slug'>) {
    return {
      name: fields.name,
      sku: fields.sku,
      categoryId: fields.categoryId,
      brandId: fields.brandId ?? null,
      description: fields.description,
      shortDescription: fields.shortDescription,
      specifications: fields.specifications ? toJson(fields.specifications) : null,
      features: fields.features ? toJson(fields.features) : null,
      optionTypes: fields.optionTypes ? toJson(fields.optionTypes) : null,
      warranty: fields.warranty,
      returnPolicy: fields.returnPolicy,
      returnWindowDays: fields.returnWindowDays,
      isReturnable: fields.isReturnable,
      codAvailable: fields.codAvailable,
      taxRatePct: fields.taxRatePct,
      status: fields.status,
      isFeatured: fields.isFeatured,
      seoTitle: fields.seoTitle,
      seoDescription: fields.seoDescription,
      seoKeywords: fields.seoKeywords,
    };
  }

  private variantData(productId: string, v: ProductInput['variants'][number], forceDefault: boolean) {
    return {
      productId,
      sku: v.sku,
      name: v.name,
      options: v.options ? toJson(v.options) : null,
      mrp: v.mrp,
      price: v.price,
      costPrice: v.costPrice,
      weightGrams: v.weightGrams,
      dimensions: v.dimensions,
      stockOnHand: v.stockOnHand,
      lowStockThreshold: v.lowStockThreshold,
      isDefault: v.isDefault || forceDefault,
      isActive: v.isActive,
    };
  }

  private priceAggregates(variants: ProductInput['variants']) {
    const active = variants.filter((v) => v.isActive !== false);
    const list = active.length ? active : variants;
    const minPrice = Math.min(...list.map((v) => v.price));
    const maxMrp = Math.max(...list.map((v) => v.mrp));
    return { minPrice, maxMrp, discountPct: discountPct(maxMrp, minPrice) };
  }

  private assertSingleDefault(variants: ProductInput['variants']) {
    if (variants.filter((v) => v.isDefault).length > 1) {
      throw new BadRequestException('Only one variant can be the default.');
    }
    const skus = variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('Variant SKUs must be unique.');
    }
  }

  private async assertSkuFree(sku: string) {
    const exists = await this.prisma.product.findUnique({ where: { sku } });
    if (exists) throw new ConflictException(`SKU "${sku}" is already in use.`);
  }

  private async assertProduct(id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 0; i < 20; i++) {
      const exists = await this.prisma.product.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = `${base}-${i + 2}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
