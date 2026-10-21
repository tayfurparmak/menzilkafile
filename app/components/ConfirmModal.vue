<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen && !props.isLoading) {
    emit('cancel')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
    @click.self="emit('cancel')"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-modal="true"
    >
      <h3 class="text-lg font-bold text-slate-900">
        {{ title }}
      </h3>
      <p class="text-sm text-slate-600 leading-relaxed">
        {{ message }}
      </p>

      <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          class="btn-secondary"
          :disabled="isLoading"
          @click="emit('cancel')"
        >
          {{ cancelText || 'Vazgeç' }}
        </button>
        <button
          type="button"
          :class="isDanger ? 'btn-danger' : 'btn-primary'"
          :disabled="isLoading"
          @click="emit('confirm')"
        >
          <span v-if="isLoading" class="mr-2 animate-spin">⏳</span>
          {{ confirmText || 'Onayla' }}
        </button>
      </div>
    </div>
  </div>
</template>
