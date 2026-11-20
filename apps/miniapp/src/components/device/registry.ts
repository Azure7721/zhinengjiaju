/**
 * 动态控件注册表（docs/05 · 4.1）
 * capability → 组件；未知能力按 resolveControl 降级 → GenericControl，不白屏。
 */
import type { Component } from 'vue';
import { resolveControl, type CapabilityDef } from '@smart-home/shared';
import PowerSwitch from './PowerSwitch.vue';
import TemperatureDial from './TemperatureDial.vue';
import PositionSlider from './PositionSlider.vue';
import ModeSegmented from './ModeSegmented.vue';
import RemotePad from './RemotePad.vue';
import Pm25Panel from './Pm25Panel.vue';
import GenericControl from './GenericControl.vue';

/** 按能力 key 直接命中（docs/05 · 4.1 的 CONTROL_REGISTRY） */
export const CONTROL_REGISTRY: Record<string, Component> = {
  switch: PowerSwitch,
  temperature: TemperatureDial,
  position: PositionSlider,
  mode: ModeSegmented,
  fanSpeed: ModeSegmented,
  remote: RemotePad,
  pm25: Pm25Panel,
  brightness: PositionSlider,
};

/** 按控件类型兜底（dial/slider/segmented/... → 组件） */
const BY_CONTROL: Record<string, Component> = {
  switch: PowerSwitch,
  dial: TemperatureDial,
  slider: PositionSlider,
  segmented: ModeSegmented,
  remote: RemotePad,
  panel: Pm25Panel,
  generic: GenericControl,
};

export function resolveControlComponent(cap: CapabilityDef): Component {
  return (
    CONTROL_REGISTRY[cap.key] ??
    BY_CONTROL[resolveControl(cap.key, cap)] ??
    GenericControl
  );
}

/** 控件通用 props 契约 */
export interface ControlProps {
  cap: CapabilityDef;
  value: unknown;
  disabled?: boolean;
}
