<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    label?: string
    id?: string
    type?: string
    placeholder?: string
    error?: string | null
    hint?: string
    required?: boolean
    disabled?: boolean
  }>(),
  {
    type: 'text',
    placeholder: '',
    error: null,
    hint: '',
    required: false,
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const inputId = computed(() => {
  return useId ? useId() : `input-${Math.random().toString(36).substring(2, 9)}`
})
</script>

<template>
  <div class="space-y-1">
    <label
      v-if="label"
      :for="id || inputId"
      class="block text-xs font-semibold text-slate-700"
    >
      {{ label }}
      <span v-if="required" class="text-rose-500">*</span>
    </label>

    <div class="relative">
      <input
        :id="id || inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :class="[
          'w-full px-3 py-2 text-sm bg-white border rounded-lg transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
          error
            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900 placeholder-rose-300'
            : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200 text-slate-800 placeholder-slate-400'
        ]"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <p v-if="error" class="text-xs text-rose-600 font-medium">
      {{ error }}
    </p>
    <p v-else-if="hint" class="text-xs text-slate-500">
      {{ hint }}
    </p>
  </div>
</template>
