import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { shippingZoneInputSchema } from '@shopcraft/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { dec, validate } from '../common/utils';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

@Controller('admin/shipping')
export class ShippingAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @RequirePerms('shipping.read')
  @Get('zones')
  async zones() {
    const rows = await this.prisma.shippingZone.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { pincodes: true },
    });
    return rows.map((z) => ({
      id: z.id, name: z.name, fee: dec(z.fee),
      freeAbove: z.freeAbove == null ? null : dec(z.freeAbove),
      minDeliveryDays: z.minDeliveryDays, maxDeliveryDays: z.maxDeliveryDays,
      codAvailable: z.codAvailable, isDefault: z.isDefault, isActive: z.isActive,
      pincodes: z.pincodes.map((p) => p.pincode),
    }));
  }

  @RequirePerms('shipping.write')
  @Post('zones')
  async createZone(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(shippingZoneInputSchema, body);
    const { pincodes, ...data } = dto;
    const zone = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) await tx.shippingZone.updateMany({ data: { isDefault: false } });
      const created = await tx.shippingZone.create({ data });
      if (pincodes.length) {
        await tx.zonePincode.createMany({ data: pincodes.map((pincode) => ({ zoneId: created.id, pincode })) });
      }
      return created;
    });
    await this.audit.log({ actorId: user.id, action: 'shipping_zone.create', entity: 'ShippingZone', entityId: zone.id, metadata: { name: dto.name } });
    return zone;
  }

  @RequirePerms('shipping.write')
  @Put('zones/:id')
  async updateZone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(shippingZoneInputSchema, body);
    const { pincodes, ...data } = dto;
    const zone = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) await tx.shippingZone.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      const updated = await tx.shippingZone.update({ where: { id }, data });
      await tx.zonePincode.deleteMany({ where: { zoneId: id } });
      if (pincodes.length) {
        await tx.zonePincode.createMany({ data: pincodes.map((pincode) => ({ zoneId: id, pincode })) });
      }
      return updated;
    });
    await this.audit.log({ actorId: user.id, action: 'shipping_zone.update', entity: 'ShippingZone', entityId: id, metadata: { name: dto.name } });
    return zone;
  }

  @RequirePerms('shipping.write')
  @Delete('zones/:id')
  async deleteZone(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const zone = await this.prisma.shippingZone.findUnique({ where: { id } });
    if (!zone) throw new BadRequestException('Zone not found');
    if (zone.isDefault) throw new BadRequestException('The default zone cannot be deleted. Mark another zone as default first.');
    await this.prisma.zonePincode.deleteMany({ where: { zoneId: id } });
    await this.prisma.shippingZone.delete({ where: { id } });
    await this.audit.log({ actorId: user.id, action: 'shipping_zone.delete', entity: 'ShippingZone', entityId: id });
    return { ok: true };
  }
}
