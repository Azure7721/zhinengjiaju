import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError } from '@smart-home/shared';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL_SEC ?? 7200);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL_SEC ?? 2592000);

export interface AccessClaims {
  sub: string;
  kind: 'user' | 'admin';
  role?: string;
  fam?: string[];
  iat?: number;
  exp?: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: object, ttlSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function signAccessToken(claims: AccessClaims): string {
  return sign(claims, ACCESS_TTL);
}

export function verifyAccessToken(token: string): AccessClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new ApiError('AUTH_REQUIRED', 'malformed token');
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError('AUTH_REQUIRED', 'invalid token');
  }
  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError('AUTH_REQUIRED', 'invalid claims');
  }
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
    throw new ApiError('AUTH_REQUIRED', 'token expired');
  }
  return claims;
}

/** refresh token：随机串，明文给客户端、hash 入库 */
export function newRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
  };
}

export function hashToken(token: string): string {
  return createHmac('sha256', SECRET).update(token).digest('hex');
}

export const ACCESS_TTL_SEC = ACCESS_TTL;
