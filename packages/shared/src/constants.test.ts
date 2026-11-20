import { describe, it, expect } from 'vitest';
import { hasPermission, familyCan } from './constants';
import { ERROR_CODES, ApiError } from './errors';

describe('RBAC permissions', () => {
  it('super_admin has wildcard', () => {
    expect(hasPermission('super_admin', 'device_model:write')).toBe(true);
    expect(hasPermission('super_admin', 'anything:at:all')).toBe(true);
  });

  it('ops can write device models but not manage admins', () => {
    expect(hasPermission('ops', 'device_model:write')).toBe(true);
    expect(hasPermission('ops', 'admin:manage')).toBe(false);
  });

  it('support is read-only for devices', () => {
    expect(hasPermission('support', 'device:read')).toBe(true);
    expect(hasPermission('support', 'device_model:write')).toBe(false);
  });

  it('viewer only dashboard/log', () => {
    expect(hasPermission('viewer', 'dashboard:read')).toBe(true);
    expect(hasPermission('viewer', 'user:read')).toBe(false);
  });
});

describe('family capability matrix', () => {
  it('member can control but not manage devices', () => {
    expect(familyCan('member', 'control')).toBe(true);
    expect(familyCan('member', 'manageDevices')).toBe(false);
    expect(familyCan('member', 'inviteMembers')).toBe(false);
  });

  it('admin can invite and manage devices but not remove members', () => {
    expect(familyCan('admin', 'manageDevices')).toBe(true);
    expect(familyCan('admin', 'inviteMembers')).toBe(true);
    expect(familyCan('admin', 'removeMembers')).toBe(false);
  });

  it('owner can do everything', () => {
    expect(familyCan('owner', 'removeMembers')).toBe(true);
    expect(familyCan('owner', 'deleteFamily')).toBe(true);
    expect(familyCan('owner', 'transfer')).toBe(true);
  });
});

describe('ApiError', () => {
  it('maps error codes to http status', () => {
    const e = new ApiError('DEVICE_OFFLINE');
    expect(e.httpStatus).toBe(409);
    expect(ERROR_CODES.AUTH_REQUIRED).toBe(401);
  });
});
