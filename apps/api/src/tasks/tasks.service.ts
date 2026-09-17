import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

const PAYMENT_WINDOW_MINUTES = 45;

/**
 * Background housekeeping:
 * - Expire unpaid orders and release their stock reservations, so abandoned
 *   checkouts never hold inventory hostage.
 * - Mark stale active carts as ABANDONED for the marketing dashboard.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireUnpaidOrders() {
    const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MINUTES * 60 * 1000);
    const stale = await this.prisma.order.findMany({
      where: { status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] }, placedAt: { lte: cutoff } },
      include: { items: true },
      take: 50,
    });
    for (const order of stale) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'CANCELLED', cancelReason: 'Payment window expired', cancelledAt: new Date() },
            });
            await tx.orderStatusHistory.create({
              data: { orderId: order.id, fromStatus: order.status, toStatus: 'CANCELLED', note: 'Auto-cancelled: payment not completed in time' },
            });
            for (const item of order.items) {
              await this.inventory.release(tx, item.variantId, item.qty, order.id);
            }
            await tx.payment.updateMany({
              where: { orderId: order.id, status: { in: ['CREATED', 'PENDING'] } },
              data: { status: 'CANCELLED' },
            });
          },
          { timeout: 20_000 },
        );
        this.logger.log(`Expired unpaid order ${order.orderNumber}`);
      } catch (err) {
        this.logger.error(`Failed to expire order ${order.orderNumber}: ${(err as Error).message}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markAbandonedCarts() {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const result = await this.prisma.cart.updateMany({
      where: { status: 'ACTIVE', lastActivityAt: { lte: cutoff } },
      data: { status: 'ABANDONED' },
    });
    if (result.count > 0) this.logger.log(`Marked ${result.count} cart(s) as abandoned`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredTokens() {
    await this.prisma.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { lte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }] },
    });
    await this.prisma.otpCode.deleteMany({ where: { expiresAt: { lte: new Date(Date.now() - 24 * 3600 * 1000) } } });
  }
}
