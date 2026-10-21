<script setup lang="ts">
import { ref, onMounted } from 'vue'

const route = useRoute()
const busId = route.params.id as string
const { apiFetch, formatMoney, formatDateTime } = useApi()

const bus = ref<any>(null)
const isLoading = ref(true)
const errorMessage = ref('')

const fetchBusDetail = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await apiFetch(`/api/buses/${busId}`)
    bus.value = data
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Otobüs detayları alınamadı.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchBusDetail()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Üst Bar -->
    <div class="flex items-center justify-between">
      <NuxtLink to="/buses" class="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1">
        <span>&larr;</span> <span>Tüm Otobüsler</span>
      </NuxtLink>
      <NuxtLink
        v-if="bus && bus.isActive"
        :to="`/trips/new?busId=${bus.id}`"
        class="btn-primary"
      >
        <span class="mr-1.5 font-bold">+</span> Bu Otobüse Yeni Sefer Oluştur
      </NuxtLink>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Otobüs bilgileri yükleniyor...</p>
    </div>

    <div v-else-if="bus" class="space-y-6">
      <!-- Otobüs Bilgi Kartı -->
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center space-x-3">
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">{{ bus.plate }}</h1>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="bus.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
            >
              {{ bus.isActive ? 'Aktif Araç' : 'Pasif' }}
            </span>
          </div>
          <p class="text-sm text-slate-600">
            <span v-if="bus.model" class="mr-2">Model: <strong class="text-slate-900 font-bold">{{ bus.model }}</strong> |</span>
            Kapasite: <span class="font-bold text-slate-900">{{ bus.capacity }} Kişilik</span> |
            Araç Sahibi:
            <NuxtLink :to="`/owners/${bus.owner.id}`" class="font-semibold text-emerald-700 hover:underline">
              {{ bus.owner.name }}
            </NuxtLink>
            <span v-if="bus.owner.phone" class="text-slate-400"> ({{ bus.owner.phone }})</span>
          </p>
          <p v-if="bus.notes" class="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-2 inline-block">
            📝 {{ bus.notes }}
          </p>
        </div>

        <div class="text-right">
          <span class="text-xs text-slate-400 block">Kayıtlı Sefer Sayısı</span>
          <span class="text-2xl font-bold text-slate-900">{{ bus.trips.length }} Sefer</span>
        </div>
      </div>

      <!-- Sefer Geçmişi -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-slate-900">Sefer Geçmişi</h2>
            <p class="text-xs text-slate-400">Bu otobüsün gerçekleştirdiği veya planlanan tüm seferler</p>
          </div>
        </div>

        <div v-if="bus.trips.length === 0" class="p-8 text-center text-slate-400 text-sm">
          Bu otobüse ait henüz bir sefer kaydı bulunmamaktadır.
        </div>

        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="trip in bus.trips"
            :key="trip.id"
            class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
          >
            <div class="space-y-1">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-slate-900 text-sm">{{ trip.departureLocation }} &rarr; {{ trip.arrivalLocation }}</span>
                <span v-if="trip.convoy" class="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {{ trip.convoy.name }}
                </span>
                <StatusBadge :status="trip.status" />
              </div>
              <p class="text-xs text-slate-500">
                Sefer Başlangıç: {{ formatDateTime(trip.startsAt) }} | Bitiş: {{ formatDateTime(trip.endsAt) }}
              </p>
              <p class="text-xs text-slate-400">
                Tarihsel Araç Sahibi: <span class="font-medium text-slate-600">{{ trip.ownerNameSnapshot }}</span>
              </p>
            </div>

            <div class="text-right shrink-0 space-y-1">
              <p class="text-sm font-bold text-slate-900">{{ formatMoney(trip.agreedAmount) }}</p>
              <div class="flex items-center justify-end space-x-2">
                <span class="text-xs text-slate-500">Ödenen: {{ formatMoney(trip.totalPaid) }}</span>
                <PaymentStatusBadge :status="trip.paymentStatus" />
              </div>
              <NuxtLink :to="`/trips/${trip.id}`" class="inline-block text-xs text-emerald-700 hover:underline font-semibold mt-1">
                Sefer Detayı &rarr;
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
