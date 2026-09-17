import { Logger } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Payment gateway abstraction. Adding a new gateway (Cashfree, Stripe, ...)
 * means implementing this interface and registering it in the factory —
 * checkout/verification/webhook/refund code never changes.
 *
 * Amounts at this boundary are in the smallest currency unit (paise).
 */
export interface GatewayOrder {
  providerOrderId: string;
  /** What the frontend needs to open the gateway checkout. */
  checkout: Record<string, unknown>;
}

export interface WebhookEventData {
  eventId: string;
  type: 'payment.captured' | 'payment.failed' | 'refund.processed' | 'unknown';
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  method?: string;
  errorReason?: string;
}

export interface PaymentGateway {
  readonly name: string;
  createOrder(params: { amountPaise: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<GatewayOrder>;
  /** Verify the checkout-callback signature (handshake). */
  verifyCallbackSignature(params: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean;
  /** Verify a webhook's signature over the raw request body. */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean;
  parseWebhook(payload: any): WebhookEventData;
  createRefund(providerPaymentId: string, amountPaise: number): Promise<{ providerRefundId: string; status: 'processed' | 'pending' }>;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ============================================================
// MockPay — development gateway
// ============================================================
// Exercises the exact same handshake as Razorpay: order create → checkout →
// signed callback → server-side signature verification → signed webhook.
// The frontend "MockPay" checkout UI asks the API to simulate a gateway
// response; nothing is ever trusted without signature verification.

export class MockPayGateway implements PaymentGateway {
  readonly name = 'mock';
  private get secret() {
    return process.env.MOCKPAY_SECRET ?? 'dev-mockpay-secret';
  }

  async createOrder(params: { amountPaise: number; currency: string; receipt: string }): Promise<GatewayOrder> {
    const providerOrderId = 'mockord_' + randomBytes(8).toString('hex');
    return {
      providerOrderId,
      checkout: {
        provider: 'mock',
        providerOrderId,
        amountPaise: params.amountPaise,
        currency: params.currency,
      },
    };
  }

  sign(providerOrderId: string, providerPaymentId: string): string {
    return createHmac('sha256', this.secret).update(`${providerOrderId}|${providerPaymentId}`).digest('hex');
  }

  verifyCallbackSignature(p: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean {
    return safeEqual(this.sign(p.providerOrderId, p.providerPaymentId), p.signature);
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }

  parseWebhook(payload: any): WebhookEventData {
    return {
      eventId: payload?.eventId ?? 'unknown',
      type: payload?.type ?? 'unknown',
      providerOrderId: payload?.providerOrderId,
      providerPaymentId: payload?.providerPaymentId,
      providerRefundId: payload?.providerRefundId,
      method: payload?.method,
      errorReason: payload?.errorReason,
    };
  }

  async createRefund(providerPaymentId: string): Promise<{ providerRefundId: string; status: 'processed' }> {
    return { providerRefundId: 'mockrfnd_' + randomBytes(8).toString('hex'), status: 'processed' };
  }
}

// ============================================================
// Razorpay
// ============================================================

export class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay';
  private readonly logger = new Logger('RazorpayGateway');
  private client: any | null = null;

  private getClient() {
    if (!this.client) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Razorpay = require('razorpay');
      this.client = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    }
    return this.client;
  }

  async createOrder(params: { amountPaise: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<GatewayOrder> {
    const order = await this.getClient().orders.create({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      providerOrderId: order.id,
      checkout: {
        provider: 'razorpay',
        keyId: process.env.RAZORPAY_KEY_ID,
        providerOrderId: order.id,
        amountPaise: params.amountPaise,
        currency: params.currency,
      },
    };
  }

  verifyCallbackSignature(p: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(`${p.providerOrderId}|${p.providerPaymentId}`).digest('hex');
    return safeEqual(expected, p.signature);
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }

  parseWebhook(payload: any): WebhookEventData {
    const event = payload?.event as string | undefined;
    const paymentEntity = payload?.payload?.payment?.entity;
    const refundEntity = payload?.payload?.refund?.entity;
    let type: WebhookEventData['type'] = 'unknown';
    if (event === 'payment.captured') type = 'payment.captured';
    else if (event === 'payment.failed') type = 'payment.failed';
    else if (event === 'refund.processed') type = 'refund.processed';
    return {
      eventId: payload?.event_id ?? `${event}:${paymentEntity?.id ?? refundEntity?.id ?? Date.now()}`,
      type,
      providerOrderId: paymentEntity?.order_id,
      providerPaymentId: paymentEntity?.id ?? refundEntity?.payment_id,
      providerRefundId: refundEntity?.id,
      method: paymentEntity?.method,
      errorReason: paymentEntity?.error_description,
    };
  }

  async createRefund(providerPaymentId: string, amountPaise: number) {
    const refund = await this.getClient().payments.refund(providerPaymentId, { amount: amountPaise });
    return { providerRefundId: refund.id as string, status: (refund.status === 'processed' ? 'processed' : 'pending') as 'processed' | 'pending' };
  }
}

export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

export function paymentGatewayFactory(): PaymentGateway {
  return process.env.PAYMENT_PROVIDER === 'razorpay' ? new RazorpayGateway() : new MockPayGateway();
}
