<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: 'PLANNED' | 'ON_ROAD' | 'COMPLETED' | 'CANCELLED' | string
}>()

const statusConfig = computed(() => {
  switch (props.status) {
    case 'PLANNED':
      return {
        label: 'Planlandı',
        classes: 'bg-blue-50 text-blue-700 border border-blue-200',
      }
    case 'ON_ROAD':
      return {
        label: 'Yolda',
        classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse',
      }
    case 'COMPLETED':
      return {
        label: 'Tamamlandı',
        classes: 'bg-slate-100 text-slate-700 border border-slate-200',
      }
    case 'CANCELLED':
      return {
        label: 'İptal',
        classes: 'bg-rose-50 text-rose-700 border border-rose-200',
      }
    default:
      return {
        label: props.status,
        classes: 'bg-gray-100 text-gray-700 border border-gray-200',
      }
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
      statusConfig.classes
    ]"
  >
    {{ statusConfig.label }}
  </span>
</template>
