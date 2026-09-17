import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { validate } from '../common/utils';
import { CatalogService } from './catalog.service';
import { Public, CurrentUser, AuthUser } from '../auth/decorators';

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(120).optional(),
  brands: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v == null ? undefined : Array.isArray(v) ? v : v.split(',').filter(Boolean))),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  minDiscount: z.coerce.number().min(0).max(90).optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'popular', 'rating', 'discount']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categoryTree();
  }

  @Get('brands')
  brands() {
    return this.catalog.brands();
  }

  @Get('products')
  products(@Query() query: unknown, @CurrentUser() user?: AuthUser) {
    const dto = validate(listQuerySchema, query);
    return this.catalog.listProducts(dto, user?.id);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.catalog.getProduct(slug, user?.id);
  }

  @Get('search/suggestions')
  suggestions(@Query('q') q = '') {
    return this.catalog.suggestions(q);
  }

  @Get('search/popular')
  popular() {
    return this.catalog.popularSearches();
  }

  @Get('delivery/:pincode')
  delivery(@Param('pincode') pincode: string) {
    const p = validate(z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'), pincode);
    return this.catalog.checkDelivery(p);
  }
}
