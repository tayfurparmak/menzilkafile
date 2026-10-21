<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  icon?: string
  actionText?: string
}>()

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 space-y-3 shadow-sm">
    <div class="text-4xl select-none">{{ icon || '📦' }}</div>
    <h3 class="text-base font-bold text-slate-800 tracking-tight">{{ title }}</h3>
    <p v-if="description" class="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
      {{ description }}
    </p>
    <div v-if="actionText" class="pt-2">
      <button type="button" class="btn-primary" @click="emit('action')">
        {{ actionText }}
      </button>
    </div>
  </div>
</template>
