<script setup lang="ts">
import { ref, onMounted } from 'vue'

const route = useRoute()
const convoyId = route.params.id as string
const { apiFetch, formatMoney, formatDateTime } = useApi()

const convoy = ref<any>(null)
const isLoading = ref(true)
const errorMessage = ref('')

const fetchConvoyDetail = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await apiFetch(`/api/convoys/${convoyId}`)
    convoy.value = data
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Kafile detayları alınamadı.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchConvoyDetail()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Geri Dönüş ve Üst Bar -->
    <div class="flex items-center justify-between">
      <NuxtLink to="/convoys" class="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1">
        <span>&larr;</span> <span>Tüm Kafileler</span>
      </NuxtLink>
      <NuxtLink
        v-if="convoy && convoy.isActive"
        :to="`/trips/new?convoyId=${convoy.id}`"
        class="btn-primary"
      >
        <span class="mr-1.5 font-bold">+</span> Bu Kafileye Sefer Ata
      </NuxtLink>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Kafile detayları yükleniyor...</p>
    </div>

    <div v-else-if="convoy" class="space-y-6">
      <!-- Kafile Başlık Kartı -->
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center space-x-3">
            <h1 class="text-2xl font-bold text-slate-900">{{ convoy.name }}</h1>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="convoy.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
            >
              {{ convoy.isActive ? 'Aktif' : 'Pasif' }}
            </span>
          </div>
          <p class="text-sm text-slate-500">
            Kayıt: {{ formatDateTime(convoy.createdAt) }}
          </p>
          <p v-if="convoy.notes" class="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-2 inline-block">
            📝 {{ convoy.notes }}
          </p>
        </div>

        <div class="text-right">
          <span class="text-xs text-slate-400 block font-medium">Toplam Otobüs ve Sefer</span>
          <span class="text-lg font-bold text-slate-900">{{ convoy.summary.busCount }} Araç | {{ convoy.summary.tripCount }} Sefer</span>
        </div>
      </div>

      <!-- Özet Kartları -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Toplam Kapasite (Sefer Bazlı) -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sefer Bazında Toplam Kapasite</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">{{ convoy.summary.totalCapacity }} Koltuk</p>
          <p class="text-[11px] text-slate-400 mt-1 leading-snug">Sefer bazında toplam koltuk kapasitesi (aynı araç birden çok sefer yapabilir)</p>
        </div>

        <!-- Toplam Ücret -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam Sefer Ücreti</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatMoney(convoy.summary.totalAgreedAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Kafile seferleri hakedişi</p>
        </div>

        <!-- Ödenen Tutar -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yapılan Ödemeler</p>
          <p class="text-2xl font-bold text-emerald-700 mt-1">{{ formatMoney(convoy.summary.totalPaidAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Araç sahiplerine ödenen</p>
        </div>

        <!-- Kalan Borç -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kalan Borç Bakiyesi</p>
          <p class="text-2xl font-bold text-rose-600 mt-1">{{ formatMoney(convoy.summary.totalRemainingAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Ödenmesi gereken tutar</p>
        </div>
      </div>

      <!-- Bağlı Seferler Listesi -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-900">Kafileye Bağlı Seferler ({{ convoy.trips.length }})</h2>
        </div>

        <div v-if="convoy.trips.length === 0" class="p-8 text-center text-slate-400 text-sm">
          Bu kafileye henüz bir sefer atanmamıştır.
        </div>

        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="trip in convoy.trips"
            :key="trip.id"
            class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
          >
            <div class="space-y-1">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-slate-900 text-sm">{{ trip.plateSnapshot }}</span>
                <span class="text-xs text-slate-400">({{ trip.capacitySnapshot }} Kişilik)</span>
                <StatusBadge :status="trip.status" />
              </div>
              <p class="text-xs text-slate-700">
                <span class="font-semibold">{{ trip.departureLocation }}</span> &rarr;
                <span class="font-semibold">{{ trip.arrivalLocation }}</span>
              </p>
              <p class="text-xs text-slate-400">
                Tarih: {{ formatDateTime(trip.startsAt) }} | Araç Sahibi: {{ trip.ownerNameSnapshot }}
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
