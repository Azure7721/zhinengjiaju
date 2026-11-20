<script setup lang="ts">
/**
 * 动态控件宿主：按 CapabilityDef 解析组件并适配 props/事件。
 * （uni-app 小程序编译器不支持 <component :is>，此处用 v-if 分发；能力覆盖见 registry.ts）
 * 对外只暴露 (cap, value) → change(value) 契约。
 */
import { computed } from 'vue';
import type { CapabilityDef } from '@smart-home/shared';
import PowerSwitch from './PowerSwitch.vue';
import TemperatureDial from './TemperatureDial.vue';
import PositionSlider from './PositionSlider.vue';
import ModeSegmented from './ModeSegmented.vue';
import RemotePad from './RemotePad.vue';
import Pm25Panel from './Pm25Panel.vue';
import GenericControl from './GenericControl.vue';

const props = defineProps<{
  cap: CapabilityDef;
  value: unknown;
  disabled?: boolean;
}>();
const emit = defineEmits<{ change: [unknown] }>();

type Kind = 'switch' | 'dial' | 'slider' | 'segmented' | 'remote' | 'panel' | 'generic';

/** 控件分发（未知/降级路径 → generic，不白屏） */
const kind = computed<Kind>(() => {
  const cap = props.cap;
  if (cap.key === 'switch' || cap.key === 'power' || cap.control === 'switch') return 'switch';
  if (cap.control === 'remote' || cap.key === 'remote') return 'remote';
  if (cap.control === 'panel' || cap.key === 'pm25') return 'panel';
  if (cap.control === 'dial' || cap.key === 'temperature') return 'dial';
  if (cap.type === 'enum' && cap.values && cap.values.length) return 'segmented';
  if (cap.control === 'segmented') return 'generic'; // 分段但无候选值 → 降级
  if (cap.control === 'slider' || cap.type === 'number') return 'slider';
  return 'generic';
});

// 动态分发给不同 props 契约的控件，故用 any 承载
const bindings = computed<any>(() => {
  const cap = props.cap;
  const disabled = !!props.disabled;
  const label = cap.label ?? cap.key;

  if (kind.value === 'switch') {
    return { modelValue: props.value === true, disabled, variant: 'pill' };
  }
  if (kind.value === 'dial') {
    return {
      value: Number(props.value ?? cap.min ?? 26),
      min: cap.min ?? 16,
      max: cap.max ?? 30,
      step: cap.step ?? 1,
      unit: cap.unit ?? '℃',
      label,
      disabled,
    };
  }
  if (kind.value === 'slider') {
    return {
      value: Number(props.value ?? cap.min ?? 0),
      min: cap.min ?? 0,
      max: cap.max ?? 100,
      step: cap.step ?? 1,
      unit: cap.unit ?? '%',
      label,
      disabled,
    };
  }
  if (kind.value === 'segmented') {
    return { value: String(props.value ?? ''), values: cap.values ?? [], label, disabled };
  }
  if (kind.value === 'remote') {
    return { value: String(props.value ?? ''), disabled, label };
  }
  if (kind.value === 'panel') {
    return { value: Number(props.value ?? 0), label };
  }
  return { cap, value: props.value, disabled };
});

function onChange(v: unknown) {
  emit('change', v);
}
</script>

<template>
  <PowerSwitch v-if="kind === 'switch'" v-bind="bindings" @toggle="onChange" @update:modelValue="onChange" />
  <TemperatureDial v-else-if="kind === 'dial'" v-bind="bindings" @change="onChange" />
  <PositionSlider v-else-if="kind === 'slider'" v-bind="bindings" @change="onChange" />
  <ModeSegmented v-else-if="kind === 'segmented'" v-bind="bindings" @change="onChange" />
  <RemotePad v-else-if="kind === 'remote'" v-bind="bindings" @change="onChange" />
  <Pm25Panel v-else-if="kind === 'panel'" v-bind="bindings" />
  <GenericControl v-else v-bind="bindings" @change="onChange" />
</template>
