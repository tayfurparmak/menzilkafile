<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const { apiFetch, formatMoney, formatDateTime } = useApi()
const route = useRoute()
const router = useRouter()

const trips = ref<any[]>([])
const owners = ref<any[]>([])
const convoys = ref<any[]>([])
const pagination = ref({ total: 0, page: 1, limit: 20, totalPages: 1 })

// Filtreler (URL Query Senkronize)
const startDate = ref((route.query.startDate as string) || '')
const endDate = ref((route.query.endDate as string) || '')
const plate = ref((route.query.plate as string) || '')
const selectedOwnerId = ref((route.query.ownerId as string) || '')
const selectedConvoyId = ref((route.query.convoyId as string) || '')
const statusFilter = ref((route.query.status as string) || 'ALL')
const paymentStatusFilter = ref<string>((route.query.paymentStatus as string) || 'ALL')
const sortBy = ref<'startsAt' | 'endsAt' | 'agreedAmount' | 'createdAt'>((route.query.sortBy as any) || 'startsAt')
const sortOrder = ref<'asc' | 'desc'>((route.query.sortOrder as any) || 'asc')
const currentPage = ref(Number(route.query.page) || 1)

const isLoading = ref(true)
const errorMessage = ref('')

// Durum Güncelleme Modalı State
const isStatusModalOpen = ref(false)
const selectedTripForStatus = ref<any>(null)
const targetStatus = ref('ON_ROAD')
const statusError = ref('')
const isUpdatingStatus = ref(false)

// İptal İşlemi Doğrulama Modalı
const isCancelConfirmOpen = ref(false)

const syncUrl = () => {
  const query: Record<string, string> = {}
  if (startDate.value) query.startDate = startDate.value
  if (endDate.value) query.endDate = endDate.value
  if (plate.value.trim()) query.plate = plate.value.trim()
  if (selectedOwnerId.value) query.ownerId = selectedOwnerId.value
  if (selectedConvoyId.value) query.convoyId = selectedConvoyId.value
  if (statusFilter.value !== 'ALL') query.status = statusFilter.value
  if (paymentStatusFilter.value !== 'ALL') query.paymentStatus = paymentStatusFilter.value
  if (sortBy.value !== 'startsAt') query.sortBy = sortBy.value
  if (sortOrder.value !== 'asc') query.sortOrder = sortOrder.value
  if (currentPage.value > 1) query.page = currentPage.value.toString()

  router.replace({ query })
}

const fetchFilterLookups = async () => {
  try {
    const [ownersRes, convoysRes] = await Promise.all([
      apiFetch('/api/owners?limit=100&status=active'),
      apiFetch('/api/convoys?limit=100&status=active'),
    ])
    owners.value = ownersRes.items
    convoys.value = convoysRes.items
  } catch (err) {
    console.error('Filtre verileri yüklenemedi:', err)
  }
}

const fetchTrips = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (startDate.value) params.append('startDate', startDate.value)
    if (endDate.value) params.append('endDate', endDate.value)
    if (plate.value.trim()) params.append('plate', plate.value.trim())
    if (selectedOwnerId.value) params.append('ownerId', selectedOwnerId.value)
    if (selectedConvoyId.value) params.append('convoyId', selectedConvoyId.value)
    if (statusFilter.value !== 'ALL') params.append('status', statusFilter.value)
    if (paymentStatusFilter.value !== 'ALL') params.append('paymentStatus', paymentStatusFilter.value)
    params.append('sortBy', sortBy.value)
    params.append('sortOrder', sortOrder.value)
    params.append('page', currentPage.value.toString())
    params.append('limit', pagination.value.limit.toString())

    const res = await apiFetch(`/api/trips?${params.toString()}`)
    trips.value = res.items
    pagination.value = res.pagination
    currentPage.value = res.pagination.page
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Seferler yüklenirken bir hata oluştu.'
  } finally {
    isLoading.value = false
  }
}

const goToPage = (p: number) => {
  if (p < 1 || p > pagination.value.totalPages || p === currentPage.value) return
  currentPage.value = p
  syncUrl()
  fetchTrips()
}

const isExportingCsv = ref(false)

const exportCsv = async () => {
  if (isExportingCsv.value) return
  isExportingCsv.value = true
  try {
    const params = new URLSearchParams()
    if (startDate.value) params.append('startDate', startDate.value)
    if (endDate.value) params.append('endDate', endDate.value)
    if (plate.value.trim()) params.append('plate', plate.value.trim())
    if (selectedOwnerId.value) params.append('ownerId', selectedOwnerId.value)
    if (selectedConvoyId.value) params.append('convoyId', selectedConvoyId.value)
    if (statusFilter.value !== 'ALL') params.append('status', statusFilter.value)
    if (paymentStatusFilter.value !== 'ALL') params.append('paymentStatus', paymentStatusFilter.value)
    params.append('sortBy', sortBy.value)
    params.append('sortOrder', sortOrder.value)
    params.append('format', 'csv')

    const url = `/api/trips?${params.toString()}`
    const { token } = useAuth()
    const res = await fetch(url, {
      headers: {
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.statusMessage || 'CSV dosyası indirilemedi.')
    }

    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.setAttribute('download', `seferler_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (e: any) {
    alert('CSV indirme başarısız: ' + (e.message || 'Hata oluştu'))
  } finally {
    isExportingCsv.value = false
  }
}

let searchTimer: any = null
watch(plate, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    syncUrl()
    fetchTrips()
  }, 300)
})

watch(
  [startDate, endDate, selectedOwnerId, selectedConvoyId, statusFilter, paymentStatusFilter, sortBy, sortOrder],
  () => {
    currentPage.value = 1
    syncUrl()
    fetchTrips()
  }
)

const resetFilters = () => {
  startDate.value = ''
  endDate.value = ''
  plate.value = ''
  selectedOwnerId.value = ''
  selectedConvoyId.value = ''
  statusFilter.value = 'ALL'
  paymentStatusFilter.value = 'ALL'
  sortBy.value = 'startsAt'
  sortOrder.value = 'asc'
  currentPage.value = 1
  syncUrl()
  fetchTrips()
}

// Durum Değiştirme
const openStatusModal = (trip: any) => {
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    alert('Bu sefer son duruma ulaştığı için durumu değiştirilemez.')
    return
  }

  selectedTripForStatus.value = trip
  statusError.value = ''
  // Varsayılan hedef durum
  if (trip.status === 'PLANNED') {
    targetStatus.value = 'ON_ROAD'
  } else if (trip.status === 'ON_ROAD') {
    targetStatus.value = 'COMPLETED'
  }
  isStatusModalOpen.value = true
}

const handleStatusSubmit = () => {
  if (!selectedTripForStatus.value) return
  statusError.value = ''

  // Ödeme kontrolü
  if (targetStatus.value === 'CANCELLED' && selectedTripForStatus.value.paymentCount > 0) {
    statusError.value =
      'Bu sefere ait ödeme kayıtları bulunmaktadır. Ödemesi olan bir sefer iptal edilemez. Önce sefer detayından ödemeleri silmelisiniz.'
    return
  }

  // İptal ise ekstra onay iste
  if (targetStatus.value === 'CANCELLED') {
    isCancelConfirmOpen.value = true
    return
  }

  executeStatusUpdate()
}

const executeStatusUpdate = async () => {
  if (!selectedTripForStatus.value) return
  statusError.value = ''
  isUpdatingStatus.value = true

  try {
    await apiFetch(`/api/trips/${selectedTripForStatus.value.id}/status`, {
      method: 'POST',
      body: {
        status: targetStatus.value,
        currentStatus: selectedTripForStatus.value.status,
      },
    })
    isCancelConfirmOpen.value = false
    isStatusModalOpen.value = false
    selectedTripForStatus.value = null
    await fetchTrips()
  } catch (err: any) {
    isCancelConfirmOpen.value = false
    statusError.value = err.data?.statusMessage || 'Durum güncellenirken hata oluştu.'
    // Eğer 409 Conflict ise listeyi yenile
    if (err.statusCode === 409) {
      await fetchTrips()
    }
  } finally {
    isUpdatingStatus.value = false
  }
}

onMounted(() => {
  fetchFilterLookups()
  fetchTrips()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Sayfa Başlığı ve İşlem Butonları -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Sefer Yönetimi</h1>
        <p class="text-sm text-slate-500 mt-1">Tüm seferlerin kalkış-varış, araç ve mali takip listesi</p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          type="button"
          class="btn-secondary flex items-center space-x-1.5"
          :disabled="isExportingCsv"
          @click="exportCsv"
        >
          <span v-if="isExportingCsv" class="inline-block animate-spin">⏳</span>
          <span v-else>📥</span>
          <span>{{ isExportingCsv ? 'İndiriliyor...' : 'CSV İndir' }}</span>
        </button>
        <NuxtLink to="/trips/new" class="btn-primary">
          <span class="mr-1.5 font-bold">+</span> Yeni Sefer Oluştur
        </NuxtLink>
      </div>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Gelişmiş Filtre ve Sıralama Çubuğu -->
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <!-- Plaka Ara -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Plaka</label>
          <input
            v-model="plate"
            type="text"
            placeholder="Plakaya göre ara..."
            class="input-field text-xs py-1.5"
          />
        </div>

        <!-- Araç Sahibi Filtresi -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Araç Sahibi</label>
          <select v-model="selectedOwnerId" class="input-field text-xs py-1.5">
            <option value="">Tüm Araç Sahipleri</option>
            <option v-for="owner in owners" :key="owner.id" :value="owner.id">
              {{ owner.name }}
            </option>
          </select>
        </div>

        <!-- Kafile Filtresi -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Kafile</label>
          <select v-model="selectedConvoyId" class="input-field text-xs py-1.5">
            <option value="">Tüm Kafileler</option>
            <option v-for="c in convoys" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>

        <!-- Sefer Durumu -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Sefer Durumu</label>
          <select v-model="statusFilter" class="input-field text-xs py-1.5">
            <option value="ALL">Tüm Durumlar</option>
            <option value="PLANNED">Planlandı</option>
            <option value="ON_ROAD">Yolda</option>
            <option value="COMPLETED">Tamamlandı</option>
            <option value="CANCELLED">İptal</option>
          </select>
        </div>

        <!-- Ödeme Durumu -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Ödeme Durumu</label>
          <select v-model="paymentStatusFilter" class="input-field text-xs py-1.5">
            <option value="ALL">Tüm Ödemeler</option>
            <option value="UNPAID">Ödenmedi</option>
            <option value="PARTIALLY_PAID">Kısmi Ödendi</option>
            <option value="PAID">Tamamı Ödendi</option>
            <option value="NO_PAYMENT_REQUIRED">Ödeme Gerekmiyor</option>
          </select>
        </div>

        <!-- Başlangıç Tarihi -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tarih (Başlangıç)</label>
          <input
            v-model="startDate"
            type="date"
            class="input-field text-xs py-1.5"
          />
        </div>

        <!-- Bitiş Tarihi -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tarih (Bitiş)</label>
          <input
            v-model="endDate"
            type="date"
            class="input-field text-xs py-1.5"
          />
        </div>

        <!-- Sıralama Kriteri & Yönü -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Sıralama</label>
          <div class="grid grid-cols-2 gap-1.5">
            <select v-model="sortBy" class="input-field text-xs py-1.5">
              <option value="startsAt">Kalkış</option>
              <option value="endsAt">Varış</option>
              <option value="agreedAmount">Ücret</option>
              <option value="createdAt">Kayıt</option>
            </select>
            <select v-model="sortOrder" class="input-field text-xs py-1.5">
              <option value="asc">Artan &uarr;</option>
              <option value="desc">Azalan &darr;</option>
            </select>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-100">
        <span class="text-xs text-slate-500">
          Toplam <strong>{{ pagination.total }}</strong> sefer bulundu
        </span>
        <button
          type="button"
          class="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          @click="resetFilters"
        >
          Filtreleri Temizle
        </button>
      </div>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Seferler listeleniyor...</p>
    </div>

    <!-- Boş Liste -->
    <AppEmptyState
      v-else-if="trips.length === 0"
      icon="🛣️"
      title="Sefer Bulunamadı"
      description="Seçilen filtre kriterlerine uygun bir sefer kaydı bulunamadı."
      actionText="Yeni Sefer Oluştur"
      @action="navigateTo('/trips/new')"
    />

    <!-- Seferler Listesi -->
    <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Masaüstü Tablo -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th class="py-3.5 px-4">Plaka / Sahip</th>
              <th class="py-3.5 px-4">Güzergâh</th>
              <th class="py-3.5 px-4">Tarih (Başlangıç - Bitiş)</th>
              <th class="py-3.5 px-4">Kafile</th>
              <th class="py-3.5 px-4">Anlaşılan Ücret</th>
              <th class="py-3.5 px-4">Ödenen</th>
              <th class="py-3.5 px-4">Kalan Borç</th>
              <th class="py-3.5 px-4">Sefer Durumu</th>
              <th class="py-3.5 px-4">Ödeme Durumu</th>
              <th class="py-3.5 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="trip in trips" :key="trip.id" class="hover:bg-slate-50/80 transition-colors">
              <td class="py-3.5 px-4">
                <NuxtLink :to="`/trips/${trip.id}`" class="font-bold text-slate-900 hover:text-emerald-700 hover:underline">
                  {{ trip.plate }}
                </NuxtLink>
                <span class="text-xs text-slate-400 block">({{ trip.capacity }} Kişilik)</span>
                <span class="text-xs text-slate-500 block truncate max-w-[130px]">{{ trip.ownerName }}</span>
              </td>
              <td class="py-3.5 px-4">
                <span class="font-medium text-slate-900">{{ trip.departureLocation }}</span>
                <span class="text-slate-400 mx-1">&rarr;</span>
                <span class="font-medium text-slate-900">{{ trip.arrivalLocation }}</span>
              </td>
              <td class="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                <span class="block font-medium text-slate-800">{{ formatDateTime(trip.startsAt) }}</span>
                <span class="text-slate-400">{{ formatDateTime(trip.endsAt) }}</span>
              </td>
              <td class="py-3.5 px-4 text-xs">
                <span v-if="trip.convoyName" class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                  {{ trip.convoyName }}
                </span>
                <span v-else class="text-slate-400">-</span>
              </td>
              <td class="py-3.5 px-4 font-bold text-slate-900">{{ formatMoney(trip.agreedAmount) }}</td>
              <td class="py-3.5 px-4 font-medium text-emerald-700">{{ formatMoney(trip.totalPaid) }}</td>
              <td class="py-3.5 px-4 font-bold" :class="parseFloat(trip.remainingAmount) > 0 ? 'text-rose-600' : 'text-slate-400'">
                {{ formatMoney(trip.remainingAmount) }}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <StatusBadge :status="trip.status" />
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <PaymentStatusBadge :status="trip.paymentStatus" />
              </td>
              <td class="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                <NuxtLink :to="`/trips/${trip.id}`" class="text-xs font-semibold text-emerald-700 hover:underline">
                  Detay
                </NuxtLink>
                <button
                  v-if="trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED'"
                  type="button"
                  class="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  @click="openStatusModal(trip)"
                >
                  Durum Değiştir
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobil Kartlar -->
      <div class="md:hidden divide-y divide-slate-100">
        <div v-for="trip in trips" :key="trip.id" class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <NuxtLink :to="`/trips/${trip.id}`" class="font-bold text-slate-900 text-base hover:underline">
                {{ trip.plate }}
              </NuxtLink>
              <p class="text-xs text-slate-500">{{ trip.departureLocation }} &rarr; {{ trip.arrivalLocation }}</p>
            </div>
            <StatusBadge :status="trip.status" />
          </div>

          <div class="text-xs text-slate-500 flex items-center justify-between">
            <span>Kalkış: {{ formatDateTime(trip.startsAt) }}</span>
            <PaymentStatusBadge :status="trip.paymentStatus" />
          </div>

          <div class="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg">
            <div>
              <p class="text-slate-400">Ücret:</p>
              <p class="font-semibold text-slate-900">{{ formatMoney(trip.agreedAmount) }}</p>
            </div>
            <div>
              <p class="text-slate-400">Ödenen:</p>
              <p class="font-semibold text-emerald-700">{{ formatMoney(trip.totalPaid) }}</p>
            </div>
            <div>
              <p class="text-slate-400">Kalan:</p>
              <p class="font-bold text-rose-600">{{ formatMoney(trip.remainingAmount) }}</p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 text-xs">
            <span class="text-slate-400">Sahip: {{ trip.ownerName }}</span>
            <div class="space-x-3">
              <button
                v-if="trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED'"
                type="button"
                class="font-semibold text-slate-700"
                @click="openStatusModal(trip)"
              >
                Durum Değiştir
              </button>
              <NuxtLink :to="`/trips/${trip.id}`" class="font-bold text-emerald-700">
                Sefer Detayı &rarr;
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Sayfalama (Pagination) Kontrolleri -->
      <AppPagination
        :page="pagination.page"
        :total-pages="pagination.totalPages"
        :total="pagination.total"
        :limit="pagination.limit"
        @change="goToPage"
      />
    </div>

    <!-- Durum Güncelleme Modalı -->
    <div
      v-if="isStatusModalOpen && selectedTripForStatus"
      class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isStatusModalOpen = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
        <h3 class="text-lg font-bold text-slate-900">Sefer Durumunu Güncelle</h3>

        <div v-if="statusError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {{ statusError }}
        </div>

        <div class="space-y-3">
          <p class="text-xs text-slate-600">
            Sefer: <span class="font-bold text-slate-800">{{ selectedTripForStatus.plate }}</span>
            ({{ selectedTripForStatus.departureLocation }} &rarr; {{ selectedTripForStatus.arrivalLocation }})
          </p>
          <div class="text-xs text-slate-500 flex items-center space-x-2">
            <span>Mevcut Durum:</span>
            <StatusBadge :status="selectedTripForStatus.status" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Yeni Sefer Durumu *</label>
            <select v-model="targetStatus" class="input-field text-sm">
              <!-- PLANNED ise sadece ON_ROAD veya CANCELLED seçilebilir -->
              <template v-if="selectedTripForStatus.status === 'PLANNED'">
                <option value="ON_ROAD">🛣️ Yolda (Seferi Başlat)</option>
                <option value="CANCELLED">❌ İptal Edildi</option>
              </template>
              <!-- ON_ROAD ise sadece COMPLETED veya CANCELLED seçilebilir -->
              <template v-else-if="selectedTripForStatus.status === 'ON_ROAD'">
                <option value="COMPLETED">✅ Tamamlandı (Son Durum)</option>
                <option value="CANCELLED">❌ İptal Edildi</option>
              </template>
            </select>
          </div>

          <div v-if="targetStatus === 'CANCELLED'" class="space-y-2">
            <p v-if="selectedTripForStatus.paymentCount > 0" class="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded border border-rose-200">
              ⛔ <strong>İptal Engellendi:</strong> Bu sefere ait {{ selectedTripForStatus.paymentCount }} adet ödeme kaydı bulunmaktadır. Ödemesi olan bir sefer iptal edilemez. Önce ödemeleri silmelisiniz.
            </p>
            <p v-else class="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
              ⚠️ <strong>Dikkat:</strong> Sefer iptal edildiğinde araç takvimi boşa çıkar ve bu işlem son durumdur (geri alınamaz).
            </p>
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button type="button" class="btn-secondary" :disabled="isUpdatingStatus" @click="isStatusModalOpen = false">
            Vazgeç
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="isUpdatingStatus || (targetStatus === 'CANCELLED' && selectedTripForStatus.paymentCount > 0)"
            @click="handleStatusSubmit"
          >
            <span v-if="isUpdatingStatus" class="mr-2 animate-spin">⏳</span>
            {{ targetStatus === 'CANCELLED' ? 'İptal Onayına Geç' : 'Durumu Güncelle' }}
          </button>
        </div>
      </div>
    </div>

    <!-- İptal Doğrulama Modalı -->
    <ConfirmModal
      :is-open="isCancelConfirmOpen"
      title="Seferi İptal Etmek İstediğinize Emin Misiniz?"
      :message="`${selectedTripForStatus?.plate} plakalı sefer iptal edilecektir. İptal işlemi kalıcıdır ve sefer geriye alınamaz. Onaylıyor musunuz?`"
      confirm-text="Evet, Seferi İptal Et"
      :is-danger="true"
      :is-loading="isUpdatingStatus"
      @confirm="executeStatusUpdate"
      @cancel="isCancelConfirmOpen = false"
    />
  </div>
</template>
