<script setup lang="ts">
const props = defineProps<{
  page: number
  totalPages: number
  total: number
  limit: number
}>()

const emit = defineEmits<{
  (e: 'change', page: number): void
}>()

const changePage = (p: number) => {
  if (p < 1 || p > props.totalPages || p === props.page) return
  emit('change', p)
}
</script>

<template>
  <div
    v-if="totalPages > 1"
    class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50"
  >
    <div class="text-xs text-slate-500">
      Toplam <strong>{{ total }}</strong> kayıttan
      <strong>{{ (page - 1) * limit + 1 }}</strong> -
      <strong>{{ Math.min(page * limit, total) }}</strong> arası gösteriliyor
    </div>

    <div class="flex items-center space-x-1">
      <button
        type="button"
        class="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="page <= 1"
        @click="changePage(page - 1)"
      >
        &larr; Önceki
      </button>

      <span class="px-3 py-1 text-xs font-semibold text-slate-700">
        {{ page }} / {{ totalPages }}
      </span>

      <button
        type="button"
        class="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="page >= totalPages"
        @click="changePage(page + 1)"
      >
        Sonraki &rarr;
      </button>
    </div>
  </div>
</template>
