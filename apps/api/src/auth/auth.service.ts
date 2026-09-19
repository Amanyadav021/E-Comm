import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OTP_SENDER, OtpSender } from './otp.provider';
import type { Response } from 'express';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_PER_WINDOW = 3;

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
  ) {}

  // ---------------- Registration & password login ----------------

  async register(input: { name: string; email: string; password: string }, meta: RequestMeta) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('An account with this email already exists. Try signing in.');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        emailVerifiedAt: null,
        roles: { create: { role: { connect: { name: 'CUSTOMER' } } } },
      },
    });
    await this.notifications.notifyAdmins({
      type: 'NEW_CUSTOMER',
      title: 'New customer registered',
      body: `${user.name} (${user.email}) just created an account.`,
      data: { userId: user.id },
    });
    return this.issueTokens(user.id, meta);
  }

  async login(input: { email: string; password: string }, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.passwordHash) throw new UnauthorizedException('Incorrect email or password.');
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Incorrect email or password.');
    this.assertActive(user.status);
    return this.issueTokens(user.id, meta);
  }

  // ---------------- Google ----------------

  async googleLogin(idToken: string, meta: RequestMeta) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new BadRequestException('Google sign-in is not configured on this server.');
    if (!this.googleClient) this.googleClient = new OAuth2Client(clientId);

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google sign-in could not be verified. Please try again.');
    }
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google account did not provide the required information.');
    }

    let user = await this.prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (!user) {
      // Link to an existing email account, or create a new one
      const byEmail = await this.prisma.user.findUnique({ where: { email: payload.email } });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: payload.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(), avatarUrl: byEmail.avatarUrl ?? payload.picture },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            name: payload.name ?? payload.email.split('@')[0],
            email: payload.email,
            googleId: payload.sub,
            avatarUrl: payload.picture,
            emailVerifiedAt: new Date(),
            roles: { create: { role: { connect: { name: 'CUSTOMER' } } } },
          },
        });
        await this.notifications.notifyAdmins({
          type: 'NEW_CUSTOMER',
          title: 'New customer registered',
          body: `${user.name} signed up with Google.`,
          data: { userId: user.id },
        });
      }
    }
    this.assertActive(user.status);
    return this.issueTokens(user.id, meta);
  }

  // ---------------- Phone OTP ----------------

  async requestOtp(phone: string) {
    const windowStart = new Date(Date.now() - OTP_RESEND_WINDOW_MS);
    const recent = await this.prisma.otpCode.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (recent >= OTP_MAX_PER_WINDOW) {
      throw new BadRequestException('Too many OTP requests. Please try again in a few minutes.');
    }

    const code = randomInt(100000, 1000000).toString();
    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash: sha256(code),
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    const sent = await this.otpSender.sendOtp(phone, code);
    if (!sent) throw new BadRequestException('We could not send the OTP right now. Please try again.');

    // In development the code is returned so the flow is testable without SMS.
    const devCode = process.env.NODE_ENV === 'development' && this.otpSender.name === 'dev' ? code : undefined;
    return { sent: true, devCode };
  }

  async verifyOtp(input: { phone: string; code: string; name?: string }, meta: RequestMeta) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone: input.phone, purpose: 'LOGIN', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('This code has expired. Please request a new one.');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many incorrect attempts. Please request a new code.');
    }
    if (otp.codeHash !== sha256(input.code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Incorrect code. Please check and try again.');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    let user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: input.name?.trim() || `User ${input.phone.slice(-4)}`,
          phone: input.phone,
          phoneVerifiedAt: new Date(),
          roles: { create: { role: { connect: { name: 'CUSTOMER' } } } },
        },
      });
      await this.notifications.notifyAdmins({
        type: 'NEW_CUSTOMER',
        title: 'New customer registered',
        body: `${user.name} signed up with phone +91${input.phone}.`,
        data: { userId: user.id },
      });
    } else if (!user.phoneVerifiedAt) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    }
    this.assertActive(user.status);
    return this.issueTokens(user.id, meta);
  }

  // ---------------- Tokens ----------------

  private assertActive(status: string) {
    if (status !== 'ACTIVE') {
      throw new ForbiddenException('This account has been disabled. Contact support for help.');
    }
  }

  async issueTokens(userId: string, meta: RequestMeta): Promise<{ user: SafeUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    const roles = user.roles.map((r) => r.role.name);

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, name: user.name, roles },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900) },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTtl = Number(process.env.JWT_REFRESH_TTL ?? 2_592_000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        userAgent: meta.userAgent?.slice(0, 250),
        ip: meta.ip?.slice(0, 60),
      },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return { user: this.toSafeUser(user, roles), tokens: { accessToken, refreshToken } };
  }

  async refresh(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) throw new UnauthorizedException('Session expired. Please sign in again.');
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    // Rotation: the old token is single-use
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.userId, meta);
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    return this.toSafeUser(user, user.roles.map((r) => r.role.name));
  }

  private toSafeUser(user: any, roles: string[]): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roles,
      emailVerified: !!user.emailVerifiedAt,
      phoneVerified: !!user.phoneVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  // ---------------- Cookies ----------------

  setAuthCookies(res: Response, tokens: TokenPair) {
    const secure = process.env.COOKIE_SECURE === 'true';
    const accessTtl = Number(process.env.JWT_ACCESS_TTL ?? 900);
    const refreshTtl = Number(process.env.JWT_REFRESH_TTL ?? 2_592_000);
    res.cookie('sc_access', tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: accessTtl * 1000,
      path: '/',
    });
    res.cookie('sc_refresh', tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: refreshTtl * 1000,
      path: '/api/auth',
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie('sc_access', { path: '/' });
    res.clearCookie('sc_refresh', { path: '/api/auth' });
  }
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
}

