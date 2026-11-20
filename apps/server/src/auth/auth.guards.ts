import { CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator, applyDecorators, UseGuards, Inject, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError, hasPermission, AdminRole } from '@smart-home/shared';
import { verifyAccessToken, AccessClaims } from './jwt';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (code: string) => SetMetadata(PERMISSION_KEY, code);

export interface AuthRequest {
  claims?: AccessClaims;
  requestId?: string;
  headers: Record<string, string>;
  user?: { id: string };
  admin?: { id: string; role: AdminRole };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers['authorization'] ?? req.headers['Authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (isPublic) return true;
      throw new ApiError('AUTH_REQUIRED', 'missing token');
    }
    const claims = verifyAccessToken(token);
    req.claims = claims;
    if (claims.kind === 'user') req.user = { id: claims.sub };
    if (claims.kind === 'admin') req.admin = { id: claims.sub, role: (claims.role ?? 'viewer') as AdminRole };
    return true;
  }
}

/** 管理员权限守卫（RBAC） */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!req.admin) throw new ApiError('AUTH_REQUIRED', 'admin token required');
    if (!hasPermission(req.admin.role, permission)) {
      throw new ApiError('FORBIDDEN', `missing permission: ${permission}`);
    }
    return true;
  }
}

/** 要求小程序用户身份 */
@Injectable()
export class UserOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!req.user) throw new ApiError('AUTH_REQUIRED', 'user token required');
    return true;
  }
}

/** 类/方法装饰器：@UserGuard() */
export function UserGuard() {
  return applyDecorators(UseGuards(UserOnlyGuard));
}

export const CurrentClaims = createParamDecorator((_data: unknown, ctx: ExecutionContext): AccessClaims => {
  const req = ctx.switchToHttp().getRequest<AuthRequest>();
  return req.claims!;
});
