import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiError, LoginResult, AdminLoginResult, FamilyRole, FAMILY_ROLES } from '@smart-home/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  signAccessToken,
  newRefreshToken,
  hashToken,
  AccessClaims,
} from './jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  /** 微信真实登录：code2Session（需要 AppID/Secret） */
  async wechatLogin(code: string): Promise<LoginResult> {
    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;
    if (!appid || !secret) {
      throw new ApiError('BAD_REQUEST', 'wechat not configured; use mock login');
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = (await res.json()) as { openid?: string; unionid?: string; session_key?: string; errcode?: number; errmsg?: string };
    if (!data.openid) {
      throw new ApiError('AUTH_REQUIRED', data.errmsg ?? 'code2session failed');
    }
    return this.upsertByOpenid(data.openid, data.unionid, data.session_key, 'wechat');
  }

  /** 开发 mock 登录：仅 WECHAT_MOCK=true 且非生产 */
  async mockLogin(nickname: string, mockOpenId?: string): Promise<LoginResult> {
    if (process.env.NODE_ENV === 'production' || process.env.WECHAT_MOCK !== 'true') {
      throw new ApiError('FORBIDDEN', 'mock login disabled');
    }
    const openid = mockOpenId ?? `mock_${nickname}_${randomUUID().slice(0, 8)}`;
    return this.upsertByOpenid(openid, undefined, undefined, 'mock', nickname);
  }

  private async upsertByOpenid(
    openid: string,
    unionid?: string,
    sessionKey?: string,
    provider = 'wechat',
    nickname?: string,
  ): Promise<LoginResult> {
    const existing = await this.prisma.weChatAccount.findUnique({
      where: { openid },
      include: { user: true },
    });

    let user = existing?.user;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          nickname: nickname ?? (provider === 'mock' ? `用户_${openid.slice(-6)}` : '微信用户'),
          wechatAccount: {
            create: {
              openid,
              unionid,
              sessionKeyHash: sessionKey ? hashToken(sessionKey) : undefined,
            },
          },
        },
      });
      // 首次登录自动建家庭
      await this.createFamilyInternal(user.id, `${user.nickname}的家`);
    } else if (sessionKey) {
      await this.prisma.weChatAccount.update({
        where: { openid },
        data: { sessionKeyHash: hashToken(sessionKey) },
      });
    }

    return this.issueUserTokens(user.id);
  }

  private async issueUserTokens(userId: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: { include: { family: true } },
      },
    });
    const families = user.memberships.map((m) => ({
      id: m.family.id,
      name: m.family.name,
      role: m.role as FamilyRole,
      ownerId: m.family.ownerId,
      createdAt: m.family.createdAt.toISOString(),
    }));

    const claims: AccessClaims = {
      sub: user.id,
      kind: 'user',
      fam: families.map((f) => f.id),
    };
    const refresh = newRefreshToken();
    await this.prisma.refreshToken.create({
      data: { tokenHash: refresh.hash, userId: user.id, expiresAt: refresh.expiresAt },
    });

    return {
      accessToken: signAccessToken(claims),
      refreshToken: refresh.token,
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? 7200),
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar ?? undefined,
        phone: user.phone ?? undefined,
        status: user.status,
      },
      families,
    };
  }

  /** 管理员登录：邮箱/密码 + 失败限流 */
  async adminLogin(email: string, password: string): Promise<AdminLoginResult> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin) throw new ApiError('AUTH_REQUIRED', 'invalid credentials');
    if (admin.status !== 'active') throw new ApiError('FORBIDDEN', 'account disabled');
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new ApiError('RATE_LIMITED', 'account locked, try later');
    }

    const passOk = await bcrypt.compare(password, admin.passwordHash);
    if (!passOk) {
      const failCount = admin.failCount + 1;
      await this.prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          failCount,
          lockedUntil: failCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      await this.audit('admin', admin.id, 'admin.login.fail', 'admin_user', admin.id);
      throw new ApiError('AUTH_REQUIRED', 'invalid credentials');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { failCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const claims: AccessClaims = { sub: admin.id, kind: 'admin', role: admin.role };
    const refresh = newRefreshToken();
    await this.prisma.refreshToken.create({
      data: { tokenHash: refresh.hash, adminId: admin.id, expiresAt: refresh.expiresAt },
    });
    await this.audit('admin', admin.id, 'admin.login', 'admin_user', admin.id);

    const { ROLE_PERMISSIONS } = await import('@smart-home/shared');
    return {
      accessToken: signAccessToken(claims),
      refreshToken: refresh.token,
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? 7200),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: admin.status,
        lastLoginAt: new Date().toISOString(),
      },
      permissions: ROLE_PERMISSIONS[admin.role as keyof typeof ROLE_PERMISSIONS] ?? [],
    };
  }

  /** refresh 轮换：旧 token 撤销，签发新对 */
  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const hash = hashToken(token);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new ApiError('AUTH_REQUIRED', 'invalid refresh token');
    }
    // 轮换：撤销旧的
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    let claims: AccessClaims;
    if (row.userId) {
      const memberships = await this.prisma.familyMember.findMany({
        where: { userId: row.userId },
        include: { family: true },
      });
      claims = { sub: row.userId, kind: 'user', fam: memberships.map((m) => m.familyId) };
    } else if (row.adminId) {
      const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: row.adminId } });
      claims = { sub: admin.id, kind: 'admin', role: admin.role };
    } else {
      throw new ApiError('AUTH_REQUIRED', 'orphan refresh token');
    }

    const next = newRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: next.hash,
        userId: row.userId ?? undefined,
        adminId: row.adminId ?? undefined,
        expiresAt: next.expiresAt,
      },
    });
    return {
      accessToken: signAccessToken(claims),
      refreshToken: next.token,
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? 7200),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { family: true } } },
    });
    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar ?? undefined,
        phone: user.phone ?? undefined,
        status: user.status,
      },
      families: user.memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        role: m.role as FamilyRole,
        ownerId: m.family.ownerId,
        createdAt: m.family.createdAt.toISOString(),
      })),
    };
  }

  async adminPermissions(adminId: string) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    const { ROLE_PERMISSIONS } = await import('@smart-home/shared');
    return {
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: admin.status,
      },
      permissions: ROLE_PERMISSIONS[admin.role as keyof typeof ROLE_PERMISSIONS] ?? [],
    };
  }

  private async createFamilyInternal(userId: string, name: string) {
    const family = await this.prisma.family.create({
      data: { name, ownerId: userId, members: { create: { userId, role: 'owner' } } },
    });
    const home = await this.prisma.home.create({
      data: { familyId: family.id, name: '我的家' },
    });
    await this.prisma.room.createMany({
      data: ['客厅', '主卧', '厨房'].map((n, i) => ({ homeId: home.id, name: n, sort: i })),
    });
    return family;
  }

  async audit(
    actorType: string,
    actorId: string | undefined,
    action: string,
    resource: string,
    resourceId?: string,
    before?: unknown,
    after?: unknown,
    ip?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorType,
        actorId,
        action,
        resource,
        resourceId,
        beforeJson: before === undefined ? undefined : JSON.stringify(before),
        afterJson: after === undefined ? undefined : JSON.stringify(after),
        ip,
      },
    });
  }
}
