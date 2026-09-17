import { Logger } from '@nestjs/common';

/**
 * Email delivery abstraction (EMAIL_PROVIDER = dev | smtp).
 * The dev sender logs the message; the SMTP sender speaks plain SMTP with
 * STARTTLS via nodemailer-free minimal implementation is intentionally NOT
 * hand-rolled — for production install nodemailer and it is picked up here.
 */
export interface EmailSender {
  send(to: string, subject: string, html: string): Promise<boolean>;
}

export class DevEmailSender implements EmailSender {
  private readonly logger = new Logger('DevEmailSender');
  async send(to: string, subject: string): Promise<boolean> {
    this.logger.log(`[DEV ONLY] Email to ${to}: ${subject}`);
    return true;
  }
}

export class SmtpEmailSender implements EmailSender {
  private readonly logger = new Logger('SmtpEmailSender');
  private transporter: any | null = null;

  private async getTransporter() {
    if (this.transporter) return this.transporter;
    try {
      // Optional dependency: npm i nodemailer -w @shopcraft/api
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      return this.transporter;
    } catch {
      this.logger.error('EMAIL_PROVIDER=smtp requires nodemailer: npm i nodemailer -w @shopcraft/api');
      return null;
    }
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    const t = await this.getTransporter();
    if (!t) return false;
    try {
      await t.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
      return true;
    } catch (err) {
      this.logger.error(`Email send failed: ${(err as Error).message}`);
      return false;
    }
  }
}

export const EMAIL_SENDER = 'EMAIL_SENDER';

export function emailSenderFactory(): EmailSender {
  return process.env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailSender() : new DevEmailSender();
}
