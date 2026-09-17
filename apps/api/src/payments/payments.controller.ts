import { Body, Controller, Headers, HttpCode, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { z } from 'zod';
import type { Request } from 'express';
import { paymentVerifySchema } from '@shopcraft/shared';
import { validate } from '../common/utils';
import { PaymentsService } from './payments.service';
import { Public, CurrentUser, AuthUser } from '../auth/decorators';

const mockSimulateSchema = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(['success', 'failure']),
});

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Frontend submits the gateway checkout result; signature is verified server-side. */
  @HttpCode(200)
  @Post('verify')
  verify(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(paymentVerifySchema, body);
    return this.payments.verifyCallback(user.id, dto);
  }

  /** Customer retries payment on a PENDING_PAYMENT / PAYMENT_FAILED order. */
  @HttpCode(200)
  @Post('retry/:orderId')
  retry(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.retryPayment(user.id, orderId);
  }

  /** Gateway server-to-server webhook. Signature-verified + idempotent. */
  @Public()
  @HttpCode(200)
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: unknown,
    @Headers('x-razorpay-signature') razorpaySig?: string,
    @Headers('x-mockpay-signature') mockSig?: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    return this.payments.handleWebhook(rawBody, razorpaySig ?? mockSig, body);
  }

  /** Dev-only MockPay checkout simulator (disabled unless PAYMENT_PROVIDER=mock). */
  @HttpCode(200)
  @Post('mock/simulate')
  mockSimulate(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = validate(mockSimulateSchema, body);
    return this.payments.mockSimulate(user.id, dto);
  }
}
