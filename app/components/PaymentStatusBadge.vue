<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: {
    code: 'NO_PAYMENT_REQUIRED' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | string
    label: string
    color: string
  } | string
}>()

const statusData = computed(() => {
  if (typeof props.status === 'object' && props.status !== null) {
    return props.status
  }
  switch (props.status) {
    case 'NO_PAYMENT_REQUIRED':
      return { code: 'NO_PAYMENT_REQUIRED', label: 'Ödeme gerekmiyor', color: 'bg-slate-100 text-slate-700 border-slate-200' }
    case 'UNPAID':
      return { code: 'UNPAID', label: 'Ödenmedi', color: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'PARTIALLY_PAID':
      return { code: 'PARTIALLY_PAID', label: 'Kısmi ödendi', color: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'PAID':
      return { code: 'PAID', label: 'Tamamı ödendi', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    default:
      return { code: 'UNKNOWN', label: props.status || '-', color: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
      statusData.color
    ]"
  >
    {{ statusData.label }}
  </span>
</template>
