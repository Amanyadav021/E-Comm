import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { fromJson } from '../common/utils';
import { IS_PUBLIC_KEY, PERMS_KEY, AuthUser } from './decorators';
import type { Permission } from '@shopcraft/shared';
import type { Request } from 'express';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req as any).cookies?.sc_access;
  return typeof cookie === 'string' && cookie.length > 0 ? cookie : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = extractToken(req);

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync(token, {
          secret: process.env.JWT_ACCESS_SECRET,
        });
        (req as any).user = { id: payload.sub, name: payload.name, roles: payload.roles ?? [] } as AuthUser;
      } catch {
        if (!isPublic) throw new UnauthorizedException('Session expired. Please sign in again.');
      }
    }

    if (!isPublic && !(req as any).user) {
      throw new UnauthorizedException('Please sign in to continue.');
    }
    return true;
  }
}

/**
 * Role permission cache — role names are stored in the JWT; the permission
 * list for each role lives in the database (editable by Super Admin) and is
 * cached here for 60 seconds.
 */
@Injectable()
export class RolePermissionResolver {
  private cache = new Map<string, { perms: string[]; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async permissionsFor(roles: string[]): Promise<Set<string>> {
    const result = new Set<string>();
    const missing: string[] = [];
    const now = Date.now();
    for (const role of roles) {
      const hit = this.cache.get(role);
      if (hit && hit.expires > now) hit.perms.forEach((p) => result.add(p));
      else missing.push(role);
    }
    if (missing.length) {
      const rows = await this.prisma.role.findMany({ where: { name: { in: missing } } });
      for (const row of rows) {
        const raw = fromJson<string[] | '*'>(row.permissions, []);
        const perms = raw === '*' ? ['*'] : raw;
        this.cache.set(row.name, { perms, expires: now + 60_000 });
        perms.forEach((p) => result.add(p));
      }
    }
    return result;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: RolePermissionResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) throw new UnauthorizedException('Please sign in to continue.');

    const granted = await this.resolver.permissionsFor(user.roles);
    if (granted.has('*')) return true;
    const ok = required.every((p) => granted.has(p));
    if (!ok) throw new ForbiddenException('You do not have permission to perform this action.');
    return true;
  }
}
