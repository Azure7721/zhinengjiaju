import { describe, expect, it } from 'vitest';
import { resolveCommandName, resolveControl, stateKeysFor } from '@smart-home/shared';
import { API_BASE, RequestError } from './request';

describe('platform/request', () => {
  it('默认 API_BASE 指向本地服务端 /api/v1', () => {
    expect(API_BASE).toContain('/api/v1');
  });

  it('RequestError 携带错误码', () => {
    const err = new RequestError('AUTH_REQUIRED', '登录已过期');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.message).toBe('登录已过期');
  });
});

describe('动态控件能力解析（与 shared CAPABILITY_REGISTRY 对齐）', () => {
  it('已知能力 → 预期控件类型', () => {
    expect(resolveControl('switch')).toBe('switch');
    expect(resolveControl('temperature')).toBe('dial');
    expect(resolveControl('position')).toBe('slider');
    expect(resolveControl('mode')).toBe('segmented');
    expect(resolveControl('remote')).toBe('remote');
    expect(resolveControl('pm25')).toBe('panel');
  });

  it('未知能力 → 按类型降级，不白屏', () => {
    expect(resolveControl('fluxLevel', { key: 'fluxLevel', type: 'number', min: 0, max: 100 })).toBe('slider');
    expect(resolveControl('wibbleMode', { key: 'wibbleMode', type: 'enum', values: ['a', 'b'] })).toBe('segmented');
    expect(resolveControl('mystery', { key: 'mystery', type: 'string' })).toBe('generic');
    expect(resolveControl('mystery')).toBe('generic');
  });

  it('命令名与状态字段可解析', () => {
    expect(resolveCommandName('temperature')).toBe('setTemperature');
    expect(resolveCommandName('switch')).toBe('setPower');
    expect(stateKeysFor('switch')).toEqual(['power']);
    expect(stateKeysFor('position')).toEqual(['position']);
    expect(stateKeysFor('unknownKey', { key: 'unknownKey', type: 'number' })).toEqual(['unknownKey']);
  });
});
