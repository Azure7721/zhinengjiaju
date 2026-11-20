import { describe, it, expect } from 'vitest';
import { validateCommandParams, BLE_UUIDS, CONTRACT_VERSION } from './index';

describe('contracts', () => {
  it('has stable BLE uuids', () => {
    expect(BLE_UUIDS.service).toBe('FFF0');
    expect(CONTRACT_VERSION).toBe(1);
  });

  it('validates command params', () => {
    const schema = { value: 'number' };
    expect(validateCommandParams({ value: 26 }, schema).valid).toBe(true);
    expect(validateCommandParams({ value: '26' }, schema).valid).toBe(false);
    expect(validateCommandParams({}, schema).valid).toBe(false);
  });
});
