<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    message: string
    dismissible?: boolean
  }>(),
  {
    title: 'Hata Oluştu',
    dismissible: false
  }
)

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()
</script>

<template>
  <div
    class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 shadow-sm"
    role="alert"
  >
    <div class="text-rose-500 mt-0.5 shrink-0 select-none">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <h4 v-if="title" class="text-sm font-semibold text-rose-900 leading-tight mb-1">
        {{ title }}
      </h4>
      <p class="text-sm text-rose-700 leading-relaxed">
        {{ message }}
      </p>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="text-rose-400 hover:text-rose-700 p-1 -mr-1 rounded-md transition-colors"
      aria-label="Kapat"
      @click="emit('dismiss')"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
