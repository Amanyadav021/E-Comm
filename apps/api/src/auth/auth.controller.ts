import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
} from '@shopcraft/shared';
import { validate } from '../common/utils';
import { AuthService, RequestMeta } from './auth.service';
import { Public, CurrentUser, AuthUser } from './decorators';

function meta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const dto = validate(registerSchema, body);
    const { user, tokens } = await this.auth.register(dto, meta(req));
    this.auth.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const dto = validate(loginSchema, body);
    const { user, tokens } = await this.auth.login(dto, meta(req));
    this.auth.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('google')
  async google(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const dto = validate(googleLoginSchema, body);
    const { user, tokens } = await this.auth.googleLogin(dto.idToken, meta(req));
    this.auth.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/request')
  async otpRequest(@Body() body: unknown) {
    const dto = validate(otpRequestSchema, body);
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/verify')
  async otpVerify(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const dto = validate(otpVerifySchema, body);
    const { user, tokens } = await this.auth.verifyOtp(dto, meta(req));
    this.auth.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).cookies?.sc_refresh as string | undefined;
    const { user, tokens } = await this.auth.refresh(token, meta(req));
    this.auth.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout((req as any).cookies?.sc_refresh);
    this.auth.clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { user: await this.auth.me(user.id) };
  }
}
