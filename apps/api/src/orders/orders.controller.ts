import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { checkoutSchema, cancelOrderSchema, returnRequestSchema } from '@shopcraft/shared';
import { validate } from '../common/utils';
import { OrdersService } from './orders.service';
import { CheckoutService } from '../checkout/checkout.service';
import { CurrentUser, AuthUser } from '../auth/decorators';

const listSchema = z.object({
  filter: z.enum(['all', 'current', 'delivered', 'cancelled', 'returned']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
});

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly checkout: CheckoutService,
  ) {}

  @HttpCode(201)
  @Post('checkout')
  createOrder(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(checkoutSchema, body);
    return this.checkout.createOrder(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    const dto = validate(listSchema, query);
    return this.orders.listMine(user.id, dto.filter, dto.page);
  }

  @Get('returns')
  returns(@CurrentUser() user: AuthUser) {
    return this.orders.listMyReturns(user.id);
  }

  @Get(':idOrNumber')
  detail(@CurrentUser() user: AuthUser, @Param('idOrNumber') idOrNumber: string) {
    return this.orders.getMine(user.id, idOrNumber);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(cancelOrderSchema, body);
    return this.orders.cancel(user.id, id, dto.reason);
  }

  @HttpCode(201)
  @Post('returns/request')
  requestReturn(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(returnRequestSchema, body);
    return this.orders.requestReturn(user.id, dto);
  }
}
