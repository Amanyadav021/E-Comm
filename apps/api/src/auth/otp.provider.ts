import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS/OTP provider abstraction. The active provider is selected with
 * OTP_PROVIDER (dev | msg91 | twilio). Additional providers only need to
 * implement sendOtp and be registered in the factory below.
 */
export interface OtpSender {
  readonly name: string;
  /** Deliver the OTP to the phone. Returns true when accepted by the provider. */
  sendOtp(phone: string, code: string): Promise<boolean>;
}

@Injectable()
export class DevOtpSender implements OtpSender {
  readonly name = 'dev';
  private readonly logger = new Logger('DevOtpSender');

  async sendOtp(phone: string, code: string): Promise<boolean> {
    this.logger.log(`[DEV ONLY] OTP for +91${phone}: ${code}`);
    return true;
  }
}

export class Msg91OtpSender implements OtpSender {
  readonly name = 'msg91';
  private readonly logger = new Logger('Msg91OtpSender');

  async sendOtp(phone: string, code: string): Promise<boolean> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    if (!authKey || !templateId) {
      this.logger.error('MSG91_AUTH_KEY / MSG91_TEMPLATE_ID not configured');
      return false;
    }
    const res = await fetch('https://control.msg91.com/api/v5/otp?' + new URLSearchParams({
      template_id: templateId,
      mobile: `91${phone}`,
      otp: code,
    }), {
      method: 'POST',
      headers: { authkey: authKey, 'content-type': 'application/json' },
    });
    if (!res.ok) this.logger.error(`MSG91 send failed: ${res.status} ${await res.text()}`);
    return res.ok;
  }
}

export class TwilioOtpSender implements OtpSender {
  readonly name = 'twilio';
  private readonly logger = new Logger('TwilioOtpSender');

  async sendOtp(phone: string, code: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
      this.logger.error('Twilio credentials not configured');
      return false;
    }
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: `+91${phone}`,
        From: from,
        Body: `${code} is your ShopCraft verification code. Valid for 5 minutes.`,
      }),
    });
    if (!res.ok) this.logger.error(`Twilio send failed: ${res.status} ${await res.text()}`);
    return res.ok;
  }
}

export const OTP_SENDER = 'OTP_SENDER';

export function otpSenderFactory(): OtpSender {
  switch (process.env.OTP_PROVIDER) {
    case 'msg91':
      return new Msg91OtpSender();
    case 'twilio':
      return new TwilioOtpSender();
    default:
      return new DevOtpSender();
  }
}
