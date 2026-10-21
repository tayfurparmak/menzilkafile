<script setup lang="ts">
import { ref, onMounted } from 'vue'

const route = useRoute()
const ownerId = route.params.id as string
const { apiFetch, formatMoney, formatDateTime } = useApi()

const owner = ref<any>(null)
const isLoading = ref(true)
const errorMessage = ref('')

const startDate = ref('')
const endDate = ref('')

const fetchOwnerDetail = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (startDate.value) params.append('startDate', startDate.value)
    if (endDate.value) params.append('endDate', endDate.value)

    const data = await apiFetch(`/api/owners/${ownerId}?${params.toString()}`)
    owner.value = data
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Araç sahibi detayları alınamadı.'
  } finally {
    isLoading.value = false
  }
}

const resetFilter = () => {
  startDate.value = ''
  endDate.value = ''
  fetchOwnerDetail()
}

onMounted(() => {
  fetchOwnerDetail()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Üst Bar ve Geri Dönüş -->
    <div class="flex items-center space-x-3">
      <NuxtLink to="/owners" class="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1">
        <span>&larr;</span> <span>Tüm Araç Sahipleri</span>
      </NuxtLink>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Araç sahibi detayları yükleniyor...</p>
    </div>

    <div v-else-if="owner" class="space-y-6">
      <!-- Başlık ve Profil Kartı -->
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center space-x-3">
            <h1 class="text-2xl font-bold text-slate-900">{{ owner.name }}</h1>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="owner.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
            >
              {{ owner.isActive ? 'Aktif' : 'Pasif' }}
            </span>
          </div>
          <p class="text-sm text-slate-500">
            Telefon: <span class="font-medium text-slate-700">{{ owner.phone || 'Belirtilmedi' }}</span> |
            Kayıt: {{ formatDateTime(owner.createdAt) }}
          </p>
          <p v-if="owner.notes" class="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-2 inline-block">
            📝 {{ owner.notes }}
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <NuxtLink
            :to="`/buses?ownerId=${owner.id}`"
            class="btn-primary"
          >
            <span class="mr-1.5 font-bold">+</span> Bu Sahibin Otobüsleri
          </NuxtLink>
        </div>
      </div>

      <!-- Mali Dönem Filtresi -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center space-x-2">
            <span class="text-sm font-semibold text-slate-800">Dönemlik Sefer ve Mali Filtre:</span>
            <span class="text-xs text-slate-500">(Sefer başlangıç tarihine göre)</span>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center space-x-2">
              <label class="text-xs text-slate-600 font-medium">Başlangıç:</label>
              <input
                v-model="startDate"
                type="date"
                class="input-field text-xs py-1.5 px-2.5 w-auto"
              />
            </div>
            <div class="flex items-center space-x-2">
              <label class="text-xs text-slate-600 font-medium">Bitiş:</label>
              <input
                v-model="endDate"
                type="date"
                class="input-field text-xs py-1.5 px-2.5 w-auto"
              />
            </div>
            <button type="button" class="btn-primary py-1.5 px-3 text-xs" @click="fetchOwnerDetail">
              Uygula
            </button>
            <button v-if="startDate || endDate" type="button" class="btn-secondary py-1.5 px-3 text-xs" @click="resetFilter">
              Temizle
            </button>
          </div>
        </div>
        <p class="text-xs text-slate-500 italic">
          * {{ owner.financialSummary.periodExplanation }}
        </p>
      </div>

      <!-- Finansal Özet Kartları (Tarihsel Sefer Kayıtları Esas Alınarak) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam Sefer Hakedişi</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatMoney(owner.financialSummary.totalAgreedAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Gerçekleşen seferler toplamı</p>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam Yapılan Ödeme</p>
          <p class="text-2xl font-bold text-emerald-700 mt-1">{{ formatMoney(owner.financialSummary.totalPaidAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Havale ve nakit ödemeler</p>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kalan Borç Bakiyesi</p>
          <p class="text-2xl font-bold text-rose-600 mt-1">{{ formatMoney(owner.financialSummary.totalRemainingAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Ödenmesi gereken net bakiye</p>
        </div>
      </div>

      <!-- 1. Kayıtlı Otobüsler -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-900">Kayıtlı Otobüsleri ({{ owner.buses.length }})</h2>
        </div>

        <div v-if="owner.buses.length === 0" class="p-8 text-center text-slate-400 text-sm">
          Bu araç sahibine ait kayıtlı otobüs bulunmuyor.
        </div>

        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="bus in owner.buses"
            :key="bus.id"
            class="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div class="flex items-center space-x-3">
              <span class="text-2xl">🚌</span>
              <div>
                <p class="font-bold text-slate-900 text-sm">{{ bus.plate }}</p>
                <p class="text-xs text-slate-500">{{ bus.capacity }} Kişilik Koltuk Kapasitesi</p>
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                :class="bus.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
              >
                {{ bus.isActive ? 'Aktif' : 'Pasif' }}
              </span>
              <NuxtLink :to="`/buses/${bus.id}`" class="btn-secondary py-1 px-2.5 text-xs">
                Otobüs Detayı
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Tarihsel Sefer Geçmişi -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-slate-900">Sefer Geçmişi ({{ owner.trips.length }})</h2>
            <p class="text-xs text-slate-400">Tarihsel olarak bu araç sahibine atanmış tüm seferler</p>
          </div>
        </div>

        <div v-if="owner.trips.length === 0" class="p-8 text-center text-slate-400 text-sm">
          Bu araç sahibiyle henüz bir sefer gerçekleştirilmedi.
        </div>

        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="trip in owner.trips"
            :key="trip.id"
            class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
          >
            <div class="space-y-1">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-slate-900 text-sm">{{ trip.plateSnapshot }}</span>
                <span class="text-xs text-slate-400">({{ trip.capacitySnapshot }} Kişilik)</span>
                <span v-if="trip.convoy" class="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {{ trip.convoy.name }}
                </span>
                <StatusBadge :status="trip.status" />
              </div>
              <p class="text-xs text-slate-700">
                <span class="font-semibold">{{ trip.departureLocation }}</span> &rarr;
                <span class="font-semibold">{{ trip.arrivalLocation }}</span>
              </p>
              <p class="text-xs text-slate-400">
                Tarih: {{ formatDateTime(trip.startsAt) }} - {{ formatDateTime(trip.endsAt) }}
              </p>
            </div>

            <div class="text-right shrink-0 space-y-1">
              <p class="text-sm font-bold text-slate-900">{{ formatMoney(trip.agreedAmount) }}</p>
              <div class="flex items-center justify-end space-x-2">
                <span class="text-xs text-slate-500">Ödenen: {{ formatMoney(trip.totalPaid) }}</span>
                <PaymentStatusBadge :status="trip.paymentStatus" />
              </div>
              <p v-if="parseFloat(trip.remainingAmount) > 0" class="text-xs font-bold text-rose-600">
                Kalan: {{ formatMoney(trip.remainingAmount) }}
              </p>
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
