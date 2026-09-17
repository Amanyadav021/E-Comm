import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type Tx = Prisma.TransactionClient;

/**
 * All stock mutations go through this service so every movement is atomic,
 * oversell-safe and leaves an InventoryTransaction audit entry.
 *
 * Stock model:
 *   stockOnHand    — physical sellable units
 *   stockReserved  — units held for orders awaiting payment
 *   available      = stockOnHand - stockReserved
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Reserve stock for a pending order. Throws when availability is insufficient (oversell guard). */
  async reserve(tx: Tx, variantId: string, qty: number, orderId: string, productName: string) {
    const result = await tx.$executeRaw`
      UPDATE ProductVariant SET stockReserved = stockReserved + ${qty}
      WHERE id = ${variantId} AND stockOnHand - stockReserved >= ${qty}`;
    if (result === 0) {
      throw new BadRequestException(`"${productName}" just went out of stock. Please update your cart.`);
    }
    await this.logTxn(tx, variantId, 'RESERVE', qty, orderId, null, null);
  }

  /** Release a reservation (payment failed/expired, order cancelled before confirmation). */
  async release(tx: Tx, variantId: string, qty: number, orderId: string) {
    await tx.$executeRaw`
      UPDATE ProductVariant SET stockReserved = CASE WHEN stockReserved >= ${qty} THEN stockReserved - ${qty} ELSE 0 END
      WHERE id = ${variantId}`;
    await this.logTxn(tx, variantId, 'RELEASE', qty, orderId, null, null);
  }

  /** Convert a reservation into a sale (payment confirmed / COD accepted). */
  async commitSale(tx: Tx, variantId: string, qty: number, orderId: string) {
    await tx.$executeRaw`
      UPDATE ProductVariant
      SET stockOnHand = stockOnHand - ${qty},
          stockReserved = CASE WHEN stockReserved >= ${qty} THEN stockReserved - ${qty} ELSE 0 END
      WHERE id = ${variantId}`;
    await this.logTxn(tx, variantId, 'SALE', -qty, orderId, null, null);
  }

  /** Return units to stock (cancellation after confirmation, approved return). */
  async restock(tx: Tx, variantId: string, qty: number, orderId: string | null, reason: string) {
    await tx.$executeRaw`
      UPDATE ProductVariant SET stockOnHand = stockOnHand + ${qty} WHERE id = ${variantId}`;
    await this.logTxn(tx, variantId, 'RETURN', qty, orderId, null, reason);
  }

  /** Manual admin adjustment (positive or negative). */
  async adjust(tx: Tx, variantId: string, qty: number, type: 'RESTOCK' | 'ADJUSTMENT', actorId: string, reason?: string) {
    if (qty < 0) {
      const result = await tx.$executeRaw`
        UPDATE ProductVariant SET stockOnHand = stockOnHand + ${qty}
        WHERE id = ${variantId} AND stockOnHand + ${qty} >= 0`;
      if (result === 0) throw new BadRequestException('Adjustment would make stock negative.');
    } else {
      await tx.$executeRaw`
        UPDATE ProductVariant SET stockOnHand = stockOnHand + ${qty} WHERE id = ${variantId}`;
    }
    await this.logTxn(tx, variantId, type, qty, null, actorId, reason ?? null);
  }

  private async logTxn(
    tx: Tx,
    variantId: string,
    type: string,
    qty: number,
    orderId: string | null,
    actorId: string | null,
    reason: string | null,
  ) {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stockOnHand: true, stockReserved: true },
    });
    await tx.inventoryTransaction.create({
      data: {
        variantId,
        type,
        qty,
        balanceAfter: variant.stockOnHand - variant.stockReserved,
        orderId,
        actorId,
        reason,
      },
    });
  }

  /** After a sale commits: alert admins for low/zero stock. Call OUTSIDE the transaction. */
  async checkLowStock(variantIds: string[]) {
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { select: { name: true } } },
    });
    for (const v of variants) {
      if (v.stockOnHand <= 0) {
        await this.notifications.notifyAdmins({
          type: 'OUT_OF_STOCK',
          title: 'Out of stock',
          body: `${v.product.name} (${v.sku}) is now out of stock.`,
          data: { variantId: v.id, productId: v.productId },
        });
      } else if (v.stockOnHand <= v.lowStockThreshold) {
        await this.notifications.notifyAdmins({
          type: 'LOW_STOCK',
          title: 'Low stock',
          body: `${v.product.name} (${v.sku}) is down to ${v.stockOnHand} units.`,
          data: { variantId: v.id, productId: v.productId },
        });
      }
    }
  }
}
