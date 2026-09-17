import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Permission } from '@shopcraft/shared';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route does not require authentication (user is still attached when a valid token is present). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMS_KEY = 'requiredPerms';
/** Route requires an authenticated staff user holding ALL listed permissions. */
export const RequirePerms = (...perms: Permission[]) => SetMetadata(PERMS_KEY, perms);

export interface AuthUser {
  id: string;
  name: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
