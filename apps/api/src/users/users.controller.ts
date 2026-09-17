import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { addressSchema } from '@shopcraft/shared';
import { validate } from '../common/utils';
import { UsersService } from './users.service';
import { CurrentUser, AuthUser } from '../auth/decorators';

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
});

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.users.updateProfile(user.id, validate(profileUpdateSchema, body));
  }

  // ---------- Addresses ----------

  @Get('addresses')
  addresses(@CurrentUser() user: AuthUser) {
    return this.users.listAddresses(user.id);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.users.createAddress(user.id, validate(addressSchema, body));
  }

  @Patch('addresses/:id')
  updateAddress(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.users.updateAddress(user.id, id, validate(addressSchema.partial(), body));
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.deleteAddress(user.id, id);
  }

  // ---------- Notifications ----------

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser, @Query('page') page = '1') {
    const p = Math.max(1, parseInt(page, 10) || 1);
    return this.users.listNotifications(user.id, p);
  }

  @Post('notifications/read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.users.markAllNotificationsRead(user.id);
  }

  @Post('notifications/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.markNotificationRead(user.id, id);
  }

  // ---------- Recently viewed ----------

  @Get('recently-viewed')
  recentlyViewed(@CurrentUser() user: AuthUser) {
    return this.users.recentlyViewed(user.id);
  }
}
