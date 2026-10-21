<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false
  }
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 select-none disabled:opacity-60 disabled:cursor-not-allowed',
      // Sizes
      size === 'sm' && 'text-xs px-2.5 py-1.5 gap-1.5',
      size === 'md' && 'text-sm px-4 py-2 gap-2',
      size === 'lg' && 'text-base px-5 py-2.5 gap-2.5',
      // Variants
      variant === 'primary' && 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500 shadow-sm',
      variant === 'secondary' && 'bg-slate-100 hover:bg-slate-200 text-slate-700 focus:ring-slate-300',
      variant === 'danger' && 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 shadow-sm',
      variant === 'outline' && 'border border-slate-300 hover:bg-slate-50 text-slate-700 focus:ring-slate-300',
      variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200'
    ]"
    @click="emit('click', $event)"
  >
    <svg
      v-if="loading"
      class="animate-spin -ml-0.5 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <slot />
  </button>
</template>
