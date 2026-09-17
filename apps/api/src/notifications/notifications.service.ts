import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../common/utils';
import { EMAIL_SENDER, EmailSender } from './email.provider';
import type { NotificationType } from '@shopcraft/shared';

interface NotifyOptions {
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Also email the user when they have an email address. */
  email?: { to?: string | null; subject?: string; html?: string };
}

/**
 * Notification hub. Every business event calls this once; the hub fans out
 * to the in-app notification center and (optionally) email. Push/SMS/WhatsApp
 * channels plug in here later without touching business code.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  /** Notify a specific customer. Never throws — notification failure must not break the business flow. */
  async notifyUser(userId: string, opts: NotifyOptions): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          audience: 'USER',
          type: opts.type,
          title: opts.title,
          body: opts.body,
          data: opts.data ? toJson(opts.data) : null,
        },
      });
      if (opts.email?.to) {
        await this.email.send(
          opts.email.to,
          opts.email.subject ?? opts.title,
          opts.email.html ?? `<p>${opts.body ?? opts.title}</p>`,
        );
      }
    } catch (err) {
      this.logger.error(`notifyUser failed: ${(err as Error).message}`);
    }
  }

  /** Broadcast to the admin notification center. */
  async notifyAdmins(opts: NotifyOptions): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: null,
          audience: 'ADMIN',
          type: opts.type,
          title: opts.title,
          body: opts.body,
          data: opts.data ? toJson(opts.data) : null,
        },
      });
    } catch (err) {
      this.logger.error(`notifyAdmins failed: ${(err as Error).message}`);
    }
  }
}
