import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { fromJson, toJson, validate } from '../common/utils';
import { PERMISSIONS, ADMIN_ROLES, passwordSchema } from '@shopcraft/shared';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

const settingsUpdateSchema = z.object({
  group: z.string().max(40).default('general'),
  values: z.record(z.string().max(80), z.any()),
});

const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
  roles: z.array(z.string()).min(1),
});

const staffUpdateSchema = z.object({
  roles: z.array(z.string()).min(1).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

const rolePermsSchema = z.object({
  permissions: z.array(z.enum(PERMISSIONS)),
});

@Controller('admin/settings')
export class SettingsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- Store settings ----------------

  @RequirePerms('settings.read')
  @Get()
  async all() {
    const rows = await this.prisma.setting.findMany();
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      grouped[row.group] = grouped[row.group] ?? {};
      grouped[row.group][row.key] = fromJson(row.value, null);
    }
    return grouped;
  }

  @RequirePerms('settings.write')
  @Put()
  async update(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(settingsUpdateSchema, body);
    for (const [key, value] of Object.entries(dto.values)) {
      await this.prisma.setting.upsert({
        where: { key },
        create: { key, value: toJson(value), group: dto.group },
        update: { value: toJson(value), group: dto.group },
      });
    }
    await this.audit.log({
      actorId: user.id, action: 'settings.update', entity: 'Setting',
      metadata: { group: dto.group, keys: Object.keys(dto.values) },
    });
    return { ok: true };
  }

  // ---------------- Staff & roles ----------------

  @RequirePerms('roles.write')
  @Get('staff')
  async staff() {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: { in: ADMIN_ROLES } } } } },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((u) => ({
      id: u.id, name: u.name, email: u.email, status: u.status,
      roles: u.roles.map((r) => r.role.name), lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
    }));
  }

  @RequirePerms('roles.write')
  @Post('staff')
  async createStaff(@CurrentUser() admin: AuthUser, @Body() body: unknown) {
    const dto = validate(staffCreateSchema, body);
    this.assertValidRoles(dto.roles);
    const exists = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('A user with this email already exists.');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        emailVerifiedAt: new Date(),
        roles: { create: dto.roles.map((name) => ({ role: { connect: { name } } })) },
      },
    });
    await this.audit.log({ actorId: admin.id, action: 'staff.create', entity: 'User', entityId: user.id, metadata: { roles: dto.roles } });
    return { id: user.id };
  }

  @RequirePerms('roles.write')
  @Patch('staff/:id')
  async updateStaff(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(staffUpdateSchema, body);
    if (id === admin.id && (dto.status === 'DISABLED' || (dto.roles && !dto.roles.includes('SUPER_ADMIN') && admin.roles.includes('SUPER_ADMIN')))) {
      throw new BadRequestException('You cannot remove your own access.');
    }
    if (dto.roles) {
      this.assertValidRoles(dto.roles);
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roles } } });
      await this.prisma.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) });
    }
    if (dto.status) {
      await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
      if (dto.status === 'DISABLED') {
        await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    }
    await this.audit.log({ actorId: admin.id, action: 'staff.update', entity: 'User', entityId: id, metadata: dto as any });
    return { ok: true };
  }

  @RequirePerms('roles.write')
  @Get('roles')
  async roles() {
    const rows = await this.prisma.role.findMany({ orderBy: { name: 'asc' } });
    return {
      permissions: PERMISSIONS,
      roles: rows
        .filter((r) => r.name !== 'CUSTOMER')
        .map((r) => ({
          id: r.id, name: r.name, label: r.label, isSystem: r.isSystem,
          permissions: fromJson<string[] | '*'>(r.permissions, []),
        })),
    };
  }

  @RequirePerms('roles.write')
  @Patch('roles/:name')
  async updateRole(@CurrentUser() admin: AuthUser, @Param('name') name: string, @Body() body: unknown) {
    const dto = validate(rolePermsSchema, body);
    if (name === 'SUPER_ADMIN') throw new BadRequestException('Super Admin permissions cannot be changed.');
    if (name === 'CUSTOMER') throw new BadRequestException('Customer role cannot be edited.');
    await this.prisma.role.update({ where: { name }, data: { permissions: toJson(dto.permissions) } });
    await this.audit.log({ actorId: admin.id, action: 'role.update', entity: 'Role', entityId: name, metadata: { permissions: dto.permissions } });
    return { ok: true };
  }

  private assertValidRoles(roles: string[]) {
    const invalid = roles.filter((r) => !ADMIN_ROLES.includes(r));
    if (invalid.length) throw new BadRequestException(`Invalid role(s): ${invalid.join(', ')}`);
  }
}

