import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from './utils';

/**
 * Audit trail for admin/system actions. Best-effort: an audit failure is
 * logged but never breaks the underlying operation.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId ?? null,
          metadata: params.metadata ? toJson(params.metadata) : null,
          ip: params.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`audit log failed for ${params.action}: ${(err as Error).message}`);
    }
  }
}
