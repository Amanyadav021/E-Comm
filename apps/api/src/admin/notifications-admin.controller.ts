import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { validate } from '../common/utils';
import { RequirePerms } from '../auth/decorators';

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  unread: z.coerce.boolean().optional(),
});

@Controller('admin/notifications')
export class NotificationsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePerms('dashboard.view')
  @Get()
  async list(@Query() query: unknown) {
    const dto = validate(listSchema, query);
    const pageSize = 20;
    const where = { audience: 'ADMIN', ...(dto.unread ? { readAt: null } : {}) };
    const [total, unread, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where: { audience: 'ADMIN' } }),
      this.prisma.notification.count({ where: { audience: 'ADMIN', readAt: null } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, unread, page: dto.page, pageSize, items };
  }

  @RequirePerms('dashboard.view')
  @Post('read-all')
  async readAll() {
    await this.prisma.notification.updateMany({ where: { audience: 'ADMIN', readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @RequirePerms('dashboard.view')
  @Post(':id/read')
  async read(@Param('id') id: string) {
    await this.prisma.notification.updateMany({ where: { id, audience: 'ADMIN' }, data: { readAt: new Date() } });
    return { ok: true };
  }
}

@Controller('admin/audit')
export class AuditAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePerms('audit.read')
  @Get()
  async list(@Query('page') page = '1', @Query('entity') entity?: string, @Query('q') q?: string) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = 30;
    const where = {
      ...(entity ? { entity } : {}),
      ...(q ? { action: { contains: q } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { name: true } } },
      }),
    ]);
    return {
      total, page: p, pageSize,
      items: rows.map((l) => ({
        id: l.id, action: l.action, entity: l.entity, entityId: l.entityId,
        metadata: l.metadata, by: l.actor?.name ?? 'System', ip: l.ip, at: l.createdAt,
      })),
    };
  }
}
