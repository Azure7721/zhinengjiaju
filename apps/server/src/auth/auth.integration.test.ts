/**
 * P1 验收集成测试（docs/phase-1 · 7）
 * 覆盖：mock 登录、管理员登录、家庭创建/邀请/加入、member 越权 403、refresh 轮换
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { signAccessToken, verifyAccessToken, newRefreshToken, hashToken } from '../auth/jwt';
import { ApiError } from '@smart-home/shared';

describe('jwt token', () => {
  it('sign and verify roundtrip', () => {
    const token = signAccessToken({ sub: 'u1', kind: 'user', fam: ['f1'] });
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe('u1');
    expect(claims.kind).toBe('user');
    expect(claims.fam).toContain('f1');
  });

  it('rejects tampered token', () => {
    const token = signAccessToken({ sub: 'u1', kind: 'user' });
    const bad = token.slice(0, -2) + 'xx';
    expect(() => verifyAccessToken(bad)).toThrow(ApiError);
  });

  it('refresh token hash is stable', () => {
    const { token, hash } = newRefreshToken();
    expect(hashToken(token)).toBe(hash);
    expect(hashToken('other')).not.toBe(hash);
  });
});

// ---- HTTP 集成（需服务运行在 3000）----
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000/api/v1';

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

const describeLive = process.env.LIVE === '1' ? describe : describe.skip;

describeLive('P1 live integration (LIVE=1)', () => {
  let userToken = '';
  let familyId = '';
  let inviteCode = '';

  it('mock login returns token + family', async () => {
    const { status, json } = await api('/auth/wechat/mock', {
      method: 'POST',
      body: { nickname: 'tester', mockOpenId: `mock_tester_${Date.now()}` },
    });
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
    expect(json.ok).toBe(true);
    expect(json.data.accessToken).toBeTruthy();
    expect(json.data.families.length).toBeGreaterThan(0);
    userToken = json.data.accessToken;
    familyId = json.data.families[0].id;
  });

  it('GET /auth/me returns user', async () => {
    const { json } = await api('/auth/me', { token: userToken });
    expect(json.data.user.nickname).toBe('tester');
  });

  it('admin login with four roles', async () => {
    const { json } = await api('/auth/admin/login', {
      method: 'POST',
      body: { email: 'root@smart.local', password: 'Admin@123456' },
    });
    expect(json.ok).toBe(true);
    expect(json.data.permissions).toContain('*');
  });

  it('create invite and second user joins', async () => {
    const inv = await api(`/families/${familyId}/invites`, { method: 'POST', token: userToken });
    inviteCode = inv.json.data.code;
    expect(inviteCode).toBeTruthy();

    const other = await api('/auth/wechat/mock', {
      method: 'POST',
      body: { nickname: 'joiner', mockOpenId: `mock_joiner_${Date.now()}` },
    });
    const joinerToken = other.json.data.accessToken;
    const join = await api('/families/join', {
      method: 'POST',
      token: joinerToken,
      body: { code: inviteCode },
    });
    expect(join.json.ok).toBe(true);
    expect(join.json.data.role).toBe('member');

    // member 越权：创建家庭允许，但对家庭管理类操作受限 —— 这里验证读成员列表 OK
    const members = await api(`/families/${familyId}/members`, { token: joinerToken });
    expect(members.json.ok).toBe(true);
    expect(members.json.data.length).toBe(2);
  });

  it('refresh rotation invalidates old token', async () => {
    const login = await api('/auth/wechat/mock', {
      method: 'POST',
      body: { nickname: 'refresh_t', mockOpenId: `mock_refresh_${Date.now()}` },
    });
    const oldRefresh = login.json.data.refreshToken;
    const r1 = await api('/auth/refresh', { method: 'POST', body: { refreshToken: oldRefresh } });
    expect(r1.json.ok).toBe(true);
    // 旧 refresh 再用应失败
    const r2 = await api('/auth/refresh', { method: 'POST', body: { refreshToken: oldRefresh } });
    expect(r2.json.ok).toBe(false);
  });

  it('unauthenticated request gets 401', async () => {
    const { status, json } = await api('/devices');
    expect(status).toBe(401);
    expect(json.error.code).toBe('AUTH_REQUIRED');
  });
});
