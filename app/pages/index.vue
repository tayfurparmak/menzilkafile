<script setup lang="ts">
import { ref, onMounted } from 'vue'

const { apiFetch, formatMoney, formatDateTime } = useApi()

const startDate = ref('')
const endDate = ref('')
const isLoading = ref(true)
const dashboardData = ref<any>(null)
const errorMessage = ref('')

const fetchDashboard = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (startDate.value) params.append('startDate', startDate.value)
    if (endDate.value) params.append('endDate', endDate.value)

    const data = await apiFetch(`/api/dashboard?${params.toString()}`)
    dashboardData.value = data
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Gösterge paneli verileri yüklenirken bir hata oluştu.'
  } finally {
    isLoading.value = false
  }
}

const resetFilter = () => {
  startDate.value = ''
  endDate.value = ''
  fetchDashboard()
}

onMounted(() => {
  fetchDashboard()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Sayfa Başlığı ve Aksiyonlar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Operasyon Gösterge Paneli</h1>
        <p class="text-sm text-slate-500 mt-1">Sistemdeki araçlar, seferler ve mali durum özeti</p>
      </div>
      <div class="flex items-center space-x-3">
        <NuxtLink to="/trips/new" class="btn-primary">
          <span class="mr-1.5 font-bold">+</span> Yeni Sefer
        </NuxtLink>
        <NuxtLink to="/buses" class="btn-secondary">
          <span>🚌</span> <span class="ml-1.5">Otobüsler</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Mali Dönem Filtresi -->
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center space-x-2">
          <span class="text-sm font-semibold text-slate-800">Mali Dönem Filtresi:</span>
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
          <button type="button" class="btn-primary py-1.5 px-3 text-xs" @click="fetchDashboard">
            Uygula
          </button>
          <button v-if="startDate || endDate" type="button" class="btn-secondary py-1.5 px-3 text-xs" @click="resetFilter">
            Temizle
          </button>
        </div>
      </div>
      <p class="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
        💡 <strong>Bilgi:</strong> {{ dashboardData?.kpi?.periodExplanation || 'Mali toplamlar; sefer başlangıç tarihi seçilen dönemde olan iptal edilmemiş seferleri ve yalnızca bu seferlere bağlı ödemeleri kapsar.' }}
      </p>
    </div>

    <!-- Yükleniyor Durumu -->
    <div v-if="isLoading && !dashboardData" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Gösterge paneli verileri hesaplanıyor...</p>
    </div>

    <div v-else-if="dashboardData" class="space-y-6">
      <!-- KPI Kartları (Operasyonel ve Finansal) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- 1. Aktif Otobüs Sayısı -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktif Otobüs Sayısı</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ dashboardData.kpi.activeBusesCount }}</p>
            <p class="text-xs text-slate-400 mt-1">Sistemde sefere hazır araçlar</p>
          </div>
          <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-2xl font-bold">
            🚌
          </div>
        </div>

        <!-- 2. Bugün Başlayan Seferler (İstanbul Saati) -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bugün Başlayan Seferler</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ dashboardData.kpi.todayTripsCount }}</p>
            <p class="text-xs text-slate-400 mt-1">İstanbul saat dilimine göre bugün</p>
          </div>
          <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold">
            📅
          </div>
        </div>

        <!-- 3. Yoldaki Sefer Sayısı -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yoldaki Seferler</p>
            <p class="text-2xl font-bold text-emerald-600 mt-1">{{ dashboardData.kpi.onRoadTripsCount }}</p>
            <p class="text-xs text-slate-400 mt-1">Şu anda aktif yolda olan araçlar</p>
          </div>
          <div class="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-2xl font-bold">
            🛣️
          </div>
        </div>

        <!-- 4. Döneme Ait Toplam Anlaşılan Ücret -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam Sefer Ücreti</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatMoney(dashboardData.kpi.totalAgreedAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Dönem seferleri için taahhüt edilen toplam</p>
        </div>

        <!-- 5. Yapılmış Ödemeler Toplamı -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yapılan Ödemeler Toplamı</p>
          <p class="text-2xl font-bold text-emerald-700 mt-1">{{ formatMoney(dashboardData.kpi.totalPaidAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Araç sahiplerine ödenen tutar</p>
        </div>

        <!-- 6. Kalan Borç Bakiyesi -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kalan Borç Bakiyesi</p>
          <p class="text-2xl font-bold text-rose-600 mt-1">{{ formatMoney(dashboardData.kpi.totalRemainingAmount) }}</p>
          <p class="text-xs text-slate-400 mt-1">Ödenmesi gereken kalan tutar</p>
        </div>
      </div>

      <!-- İki Kolonlu Liste Düzeni: Yaklaşan Seferler & Ödeme Bekleyen Seferler -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Yaklaşan Seferler -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-base font-bold text-slate-900">Yaklaşan Seferler</span>
              <span class="text-xs text-slate-400">({{ dashboardData.upcomingTrips.length }})</span>
            </div>
            <NuxtLink to="/trips" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              Tümünü Gör &rarr;
            </NuxtLink>
          </div>

          <div v-if="dashboardData.upcomingTrips.length === 0" class="p-8 text-center text-slate-400 text-sm">
            Yaklaşan planlanmış sefer bulunmuyor.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div
              v-for="trip in dashboardData.upcomingTrips"
              :key="trip.id"
              class="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
            >
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-slate-900 text-sm">{{ trip.plate }}</span>
                  <span class="text-xs text-slate-400">({{ trip.capacity }} Kişilik)</span>
                  <StatusBadge :status="trip.status" />
                </div>
                <p class="text-xs text-slate-600">
                  <span class="font-medium text-slate-800">{{ trip.departureLocation }}</span>
                  &rarr;
                  <span class="font-medium text-slate-800">{{ trip.arrivalLocation }}</span>
                </p>
                <p class="text-xs text-slate-400">
                  Kalkış: {{ formatDateTime(trip.startsAt) }} | Sahip: {{ trip.ownerName }}
                </p>
              </div>

              <div class="text-right shrink-0">
                <p class="text-sm font-bold text-slate-900">{{ formatMoney(trip.agreedAmount) }}</p>
                <div class="mt-1">
                  <PaymentStatusBadge :status="trip.paymentStatus" />
                </div>
                <NuxtLink
                  :to="`/trips/${trip.id}`"
                  class="mt-2 inline-block text-xs text-emerald-700 hover:underline font-medium"
                >
                  Detay &rarr;
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- Ödeme Bekleyen Seferler -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-base font-bold text-slate-900">Ödeme Bekleyen Seferler</span>
              <span class="text-xs text-slate-400">({{ dashboardData.unpaidTrips.length }})</span>
            </div>
            <NuxtLink to="/trips?paymentStatus=UNPAID" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              Tüm Borçlular &rarr;
            </NuxtLink>
          </div>

          <div v-if="dashboardData.unpaidTrips.length === 0" class="p-8 text-center text-slate-400 text-sm">
            Tüm seferlerin ödemeleri tamamlanmış. Kalan borç bulunmuyor.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div
              v-for="trip in dashboardData.unpaidTrips"
              :key="trip.id"
              class="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
            >
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-slate-900 text-sm">{{ trip.plate }}</span>
                  <span class="text-xs text-slate-500 font-medium">{{ trip.ownerName }}</span>
                  <StatusBadge :status="trip.status" />
                </div>
                <p class="text-xs text-slate-600">
                  {{ trip.departureLocation }} &rarr; {{ trip.arrivalLocation }}
                </p>
                <p class="text-xs text-slate-400">
                  Sefer Tarihi: {{ formatDateTime(trip.startsAt) }}
                </p>
              </div>

              <div class="text-right shrink-0">
                <p class="text-xs text-slate-500">Kalan Borç:</p>
                <p class="text-sm font-bold text-rose-600">{{ formatMoney(trip.remainingAmount) }}</p>
                <NuxtLink
                  :to="`/trips/${trip.id}`"
                  class="mt-1.5 inline-block text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold px-2 py-0.5 rounded transition-colors"
                >
                  Ödeme Gir &rarr;
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
