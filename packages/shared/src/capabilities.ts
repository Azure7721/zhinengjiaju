import type { CapabilityDef, ControlKind } from './types.js';

/**
 * 能力注册表（docs/01 · 6.2 / docs/04 · 2.3）
 * capability → 默认控件 / 状态字段 / 命令
 */
export interface CapabilityRegistryEntry {
  control: ControlKind;
  stateKeys: string[];
  command?: string;
  label: string;
}

export const CAPABILITY_REGISTRY: Record<string, CapabilityRegistryEntry> = {
  switch: { control: 'switch', stateKeys: ['power'], command: 'setPower', label: '开关' },
  temperature: {
    control: 'dial',
    stateKeys: ['targetTemp', 'currentTemp'],
    command: 'setTemperature',
    label: '温度',
  },
  position: { control: 'slider', stateKeys: ['position'], command: 'setPosition', label: '位置' },
  mode: { control: 'segmented', stateKeys: ['mode'], command: 'setMode', label: '模式' },
  fanSpeed: {
    control: 'segmented',
    stateKeys: ['fanSpeed'],
    command: 'setFanSpeed',
    label: '风速',
  },
  remote: { control: 'remote', stateKeys: ['lastKey'], command: 'sendKey', label: '遥控' },
  pm25: { control: 'panel', stateKeys: ['pm25'], label: 'PM2.5' },
  brightness: {
    control: 'slider',
    stateKeys: ['brightness'],
    command: 'setBrightness',
    label: '亮度',
  },
};

/** 未知能力 → 通用降级控件，不白屏 */
export function resolveControl(capabilityKey: string, def?: CapabilityDef): ControlKind {
  if (def?.control) return def.control;
  const entry = CAPABILITY_REGISTRY[capabilityKey];
  if (entry) return entry.control;
  if (def?.type === 'boolean') return 'switch';
  if (def?.type === 'enum') return 'segmented';
  if (def?.type === 'number') return 'slider';
  return 'generic';
}

export function resolveCommandName(capabilityKey: string, def?: CapabilityDef): string | undefined {
  const entry = CAPABILITY_REGISTRY[capabilityKey];
  if (entry?.command) return entry.command;
  // 未知能力：约定 set<Key>
  if (def && !def.readonly) {
    return `set${capabilityKey.charAt(0).toUpperCase()}${capabilityKey.slice(1)}`;
  }
  return undefined;
}

/** 能力 key → 状态字段（用于从 state 中取展示值） */
export function stateKeysFor(capabilityKey: string, def?: CapabilityDef): string[] {
  const entry = CAPABILITY_REGISTRY[capabilityKey];
  if (entry) return entry.stateKeys;
  if (def) return [capabilityKey];
  return [capabilityKey];
}
