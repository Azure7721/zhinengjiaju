<script setup lang="ts">
/** 快捷电源（首页网格用）：单设备 switch 开关 */
import { computed } from 'vue';
import type { DeviceDto } from '@smart-home/shared';
import PowerSwitch from './PowerSwitch.vue';

const props = defineProps<{ device: DeviceDto }>();
const emit = defineEmits<{ changed: [boolean] }>();

const power = computed(() => props.device.state?.state?.power === true);
const online = computed(() => props.device.state?.online ?? false);
</script>

<template>
  <PowerSwitch
    :model-value="power"
    :disabled="!online"
    variant="pill"
    @toggle="(v: boolean) => emit('changed', v)"
  />
</template>
