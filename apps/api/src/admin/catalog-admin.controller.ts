import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { productInputSchema, categoryInputSchema, brandInputSchema } from '@shopcraft/shared';
import { validate } from '../common/utils';
import { CatalogAdminService } from './catalog-admin.service';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  stock: z.enum(['low', 'out']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const imageAddSchema = z.object({
  url: z.string().min(1),
  alt: z.string().max(200).optional(),
  variantId: z.string().optional(),
});

const imageReorderSchema = z.object({
  order: z.array(z.object({ id: z.string(), sortOrder: z.number().int(), isPrimary: z.boolean().optional() })).min(1),
});

const statusSchema = z.object({ status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']) });

@Controller('admin/catalog')
export class CatalogAdminController {
  constructor(private readonly svc: CatalogAdminService) {}

  // ---------- Products ----------

  @RequirePerms('products.read')
  @Get('products')
  list(@Query() query: unknown) {
    return this.svc.listProducts(validate(listQuerySchema, query));
  }

  @RequirePerms('products.read')
  @Get('products/:id')
  get(@Param('id') id: string) {
    return this.svc.getProduct(id);
  }

  @RequirePerms('products.write')
  @Post('products')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.svc.createProduct(validate(productInputSchema, body), user.id);
  }

  @RequirePerms('products.write')
  @Put('products/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.updateProduct(id, validate(productInputSchema, body), user.id);
  }

  @RequirePerms('products.write')
  @Patch('products/:id/status')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(statusSchema, body);
    return this.svc.setProductStatus(id, dto.status, user.id);
  }

  @RequirePerms('products.write')
  @Post('products/:id/duplicate')
  duplicate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.duplicateProduct(id, user.id);
  }

  @RequirePerms('products.write')
  @Delete('products/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteProduct(id, user.id);
  }

  @RequirePerms('products.read')
  @Get('variants/:variantId/price-history')
  priceHistory(@Param('variantId') variantId: string) {
    return this.svc.priceHistory(variantId);
  }

  // ---------- Images ----------

  @RequirePerms('products.write')
  @Post('products/:id/images')
  addImage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.addImage(id, validate(imageAddSchema, body), user.id);
  }

  @RequirePerms('products.write')
  @Patch('products/:id/images/reorder')
  reorderImages(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(imageReorderSchema, body);
    return this.svc.reorderImages(id, dto.order, user.id);
  }

  @RequirePerms('products.write')
  @Delete('products/:id/images/:imageId')
  deleteImage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('imageId') imageId: string) {
    return this.svc.deleteImage(id, imageId, user.id);
  }

  // ---------- Categories ----------

  @RequirePerms('products.read')
  @Get('categories')
  categories() {
    return this.svc.listCategories();
  }

  @RequirePerms('products.write')
  @Post('categories')
  createCategory(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.svc.upsertCategory(null, validate(categoryInputSchema, body), user.id);
  }

  @RequirePerms('products.write')
  @Put('categories/:id')
  updateCategory(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.upsertCategory(id, validate(categoryInputSchema, body), user.id);
  }

  @RequirePerms('products.write')
  @Delete('categories/:id')
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteCategory(id, user.id);
  }

  // ---------- Brands ----------

  @RequirePerms('products.read')
  @Get('brands')
  brands() {
    return this.svc.listBrands();
  }

  @RequirePerms('products.write')
  @Post('brands')
  createBrand(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.svc.upsertBrand(null, validate(brandInputSchema, body), user.id);
  }

  @RequirePerms('products.write')
  @Put('brands/:id')
  updateBrand(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.upsertBrand(id, validate(brandInputSchema, body), user.id);
  }

  @RequirePerms('products.write')
  @Delete('brands/:id')
  deleteBrand(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteBrand(id, user.id);
  }
}
