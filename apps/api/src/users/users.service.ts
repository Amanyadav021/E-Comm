import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import type { AddressInput } from '@shopcraft/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async updateProfile(userId: string, input: { name?: string; email?: string }) {
    if (input.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (existing && existing.id !== userId) throw new ConflictException('This email is already in use.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name, email: input.email },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });
    return { user };
  }

  // ---------- Addresses ----------

  async listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, input: AddressInput) {
    const count = await this.prisma.address.count({ where: { userId, deletedAt: null } });
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault || count === 0) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: { ...input, isDefault: input.isDefault || count === 0, userId },
      });
    });
  }

  async updateAddress(userId: string, id: string, input: Partial<AddressInput>) {
    const address = await this.prisma.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!address) throw new NotFoundException('Address not found');
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id }, data: input });
    });
  }

  async deleteAddress(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!address) throw new NotFoundException('Address not found');
    await this.prisma.address.update({ where: { id }, data: { deletedAt: new Date(), isDefault: false } });
    return { ok: true };
  }

  // ---------- Notifications ----------

  async listNotifications(userId: string, page: number, pageSize = 20) {
    const where = { userId, audience: 'USER' };
    const [total, unread, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, unread, page, pageSize, items };
  }

  async markNotificationRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllNotificationsRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  // ---------- Recently viewed ----------

  async recentlyViewed(userId: string) {
    const rows = await this.prisma.recentlyViewed.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take: 12,
    });
    return this.catalog.cardsByIds(rows.map((r) => r.productId), userId);
  }
}

