import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { cartAddSchema, cartUpdateSchema, applyCouponSchema } from '@shopcraft/shared';
import { validate } from '../common/utils';
import { CartService } from './cart.service';
import { CurrentUser, AuthUser } from '../auth/decorators';

@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Query('pincode') pincode?: string) {
    return this.cart.getCart(user.id, pincode);
  }

  @Post('items')
  add(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(cartAddSchema, body);
    return this.cart.addItem(user.id, dto.variantId, dto.qty);
  }

  @Patch('items/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(cartUpdateSchema, body);
    return this.cart.updateItem(user.id, id, dto.qty);
  }

  @Delete('items/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cart.removeItem(user.id, id);
  }

  @Post('coupon')
  applyCoupon(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(applyCouponSchema, body);
    return this.cart.applyCoupon(user.id, dto.code);
  }

  @Delete('coupon')
  removeCoupon(@CurrentUser() user: AuthUser) {
    return this.cart.removeCoupon(user.id);
  }
}
