<script setup lang="ts">
import { ref, onMounted } from 'vue'

const route = useRoute()
const tripId = route.params.id as string
const { apiFetch, formatMoney, formatDateTime } = useApi()

const trip = ref<any>(null)
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')

// Ödeme Ekleme / Düzenleme Modal State
const isPaymentModalOpen = ref(false)
const isEditingPayment = ref(false)
const selectedPaymentId = ref<string | null>(null)
const paymentAmount = ref('')
const paymentPaidAt = ref('')
const paymentMethod = ref<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER')
const paymentNotes = ref('')
const paymentError = ref('')
const isPaymentSubmitting = ref(false)

// Ödeme Silme Onay Modalı
const isDeletePaymentOpen = ref(false)
const paymentToDelete = ref<any>(null)
const isDeletingPayment = ref(false)

// Sefer İptal / Durum Onay Modalı
const isStatusModalOpen = ref(false)
const targetStatus = ref('')
const statusModalTitle = ref('')
const statusModalMessage = ref('')
const isUpdatingStatus = ref(false)

// Ücret Düzenleme Modalı
const isFeeModalOpen = ref(false)
const newAgreedAmount = ref('')
const feeError = ref('')
const isFeeSubmitting = ref(false)

const fetchTripDetail = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await apiFetch(`/api/trips/${tripId}`)
    trip.value = data
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Sefer detayları alınamadı.'
  } finally {
    isLoading.value = false
  }
}

// Ödeme Modalı Açılış
const openAddPaymentModal = () => {
  if (trip.value.status === 'CANCELLED') {
    alert('İptal edilmiş bir sefere ödeme eklenemez.')
    return
  }

  isEditingPayment.value = false
  selectedPaymentId.value = null
  // Kalan tutarı varsayılan öneri olarak sun
  paymentAmount.value = parseFloat(trip.value.remainingAmount) > 0 ? trip.value.remainingAmount : ''

  // Şimdiki tarih-saat
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  paymentPaidAt.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`

  paymentMethod.value = 'BANK_TRANSFER'
  paymentNotes.value = ''
  paymentError.value = ''
  isPaymentModalOpen.value = true
}

const openEditPaymentModal = (p: any) => {
  isEditingPayment.value = true
  selectedPaymentId.value = p.id
  paymentAmount.value = p.amount
  
  const d = new Date(p.paidAt)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  paymentPaidAt.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`

  paymentMethod.value = p.method
  paymentNotes.value = p.notes || ''
  paymentError.value = ''
  isPaymentModalOpen.value = true
}

const savePayment = async () => {
  paymentError.value = ''
  const amt = parseFloat(paymentAmount.value)
  if (isNaN(amt) || amt <= 0) {
    paymentError.value = 'Lütfen sıfırdan büyük geçerli bir ödeme tutarı girin.'
    return
  }

  isPaymentSubmitting.value = true
  try {
    const paidAtIso = new Date(paymentPaidAt.value).toISOString()

    if (isEditingPayment.value && selectedPaymentId.value) {
      await apiFetch(`/api/payments/${selectedPaymentId.value}`, {
        method: 'PUT',
        body: {
          amount: paymentAmount.value,
          paidAt: paidAtIso,
          method: paymentMethod.value,
          notes: paymentNotes.value.trim() || null,
        },
      })
      successMessage.value = 'Ödeme kaydı başarıyla güncellendi.'
    } else {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: {
          tripId: trip.value.id,
          amount: paymentAmount.value,
          paidAt: paidAtIso,
          method: paymentMethod.value,
          notes: paymentNotes.value.trim() || null,
        },
      })
      successMessage.value = 'Yeni ödeme başarıyla kaydedildi.'
    }
    isPaymentModalOpen.value = false
    await fetchTripDetail()
  } catch (err: any) {
    paymentError.value = err.data?.statusMessage || 'Ödeme işlemi başarısız oldu.'
  } finally {
    isPaymentSubmitting.value = false
  }
}

// Ödeme Silme
const promptDeletePayment = (payment: any) => {
  paymentToDelete.value = payment
  isDeletePaymentOpen.value = true
}

const executeDeletePayment = async () => {
  if (!paymentToDelete.value) return
  isDeletingPayment.value = true
  try {
    await apiFetch(`/api/payments/${paymentToDelete.value.id}`, {
      method: 'DELETE',
    })
    isDeletePaymentOpen.value = false
    paymentToDelete.value = null
    successMessage.value = 'Ödeme kaydı başarıyla silindi.'
    await fetchTripDetail()
  } catch (err: any) {
    alert(err.data?.statusMessage || 'Ödeme silinemedi.')
  } finally {
    isDeletingPayment.value = false
  }
}

// Sefer Durumu Geçişi
const promptStatusChange = (status: string) => {
  if (status === 'CANCELLED' && trip.value.payments?.length > 0) {
    errorMessage.value =
      'Bu sefere ait ödeme kayıtları bulunmaktadır. Ödemesi olan bir sefer iptal edilemez. Önce seferin ödemelerini silmelisiniz.'
    return
  }

  targetStatus.value = status

  if (status === 'ON_ROAD') {
    statusModalTitle.value = 'Seferi Yola Çıkar'
    statusModalMessage.value = 'Bu seferin durumunu "Yolda" olarak güncellemek üzeresiniz.'
  } else if (status === 'COMPLETED') {
    statusModalTitle.value = 'Seferi Tamamla'
    statusModalMessage.value = 'Sefer başarıyla tamamlandı olarak işaretlenecek. Tamamlanan sefer son durumdur ve geriye alınamaz.'
  } else if (status === 'CANCELLED') {
    statusModalTitle.value = 'Seferi İptal Et'
    statusModalMessage.value =
      'Bu seferi iptal etmek istediğinize emin misiniz? İptal işlemi geri alınamaz ve otobüs takvimi boşa çıkar.'
  }

  isStatusModalOpen.value = true
}

const executeStatusChange = async () => {
  isUpdatingStatus.value = true
  errorMessage.value = ''
  try {
    await apiFetch(`/api/trips/${trip.value.id}/status`, {
      method: 'POST',
      body: {
        status: targetStatus.value,
        currentStatus: trip.value.status,
      },
    })
    isStatusModalOpen.value = false
    successMessage.value = 'Sefer durumu başarıyla güncellendi.'
    await fetchTripDetail()
  } catch (err: any) {
    isStatusModalOpen.value = false
    errorMessage.value = err.data?.statusMessage || 'Durum değişikliği başarısız oldu.'
  } finally {
    isUpdatingStatus.value = false
  }
}

// Ücret Güncelleme
const openFeeModal = () => {
  newAgreedAmount.value = trip.value.agreedAmount
  feeError.value = ''
  isFeeModalOpen.value = true
}

const updateTripFee = async () => {
  feeError.value = ''
  const amt = parseFloat(newAgreedAmount.value)
  if (isNaN(amt) || amt < 0) {
    feeError.value = 'Geçerli bir tutar girin.'
    return
  }

  isFeeSubmitting.value = true
  try {
    await apiFetch(`/api/trips/${trip.value.id}`, {
      method: 'PUT',
      body: { agreedAmount: newAgreedAmount.value },
    })
    isFeeModalOpen.value = false
    successMessage.value = 'Sefer ücreti başarıyla güncellendi.'
    await fetchTripDetail()
  } catch (err: any) {
    feeError.value = err.data?.statusMessage || 'Ücret güncellenemedi.'
  } finally {
    isFeeSubmitting.value = false
  }
}

// Şoför Bilgisi Güncelleme
const isDriverModalOpen = ref(false)
const driverNameInput = ref('')
const driverPhoneInput = ref('')
const isDriverSubmitting = ref(false)
const driverError = ref('')

const openDriverModal = () => {
  driverNameInput.value = trip.value.driverName || ''
  driverPhoneInput.value = trip.value.driverPhone || ''
  driverError.value = ''
  isDriverModalOpen.value = true
}

const updateDriverInfo = async () => {
  isDriverSubmitting.value = true
  driverError.value = ''
  try {
    await apiFetch(`/api/trips/${trip.value.id}`, {
      method: 'PUT',
      body: {
        driverName: driverNameInput.value.trim() || null,
        driverPhone: driverPhoneInput.value.trim() || null,
      },
    })
    isDriverModalOpen.value = false
    successMessage.value = 'Şoför bilgileri başarıyla güncellendi.'
    await fetchTripDetail()
  } catch (err: any) {
    driverError.value = err.data?.statusMessage || 'Şoför bilgileri güncellenemedi.'
  } finally {
    isDriverSubmitting.value = false
  }
}

// Seferi Kalıcı Olarak Silme
const isDeleteTripOpen = ref(false)
const isDeletingTrip = ref(false)

const promptDeleteTrip = () => {
  isDeleteTripOpen.value = true
}

const executeDeleteTrip = async () => {
  isDeletingTrip.value = true
  try {
    await apiFetch(`/api/trips/${trip.value.id}`, {
      method: 'DELETE',
    })
    await navigateTo('/trips')
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Sefer silinirken bir hata oluştu.'
    isDeleteTripOpen.value = false
  } finally {
    isDeletingTrip.value = false
  }
}

onMounted(() => {
  fetchTripDetail()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Geri Dönüş ve Durum Butonları -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <NuxtLink to="/trips" class="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1">
        <span>&larr;</span> <span>Tüm Seferler</span>
      </NuxtLink>

      <!-- Sefer Durum Geçiş Butonları -->
      <div v-if="trip" class="flex flex-wrap items-center gap-2">
        <!-- PLANNED ise: Yola Çıkar veya İptal Et -->
        <template v-if="trip.status === 'PLANNED'">
          <button
            type="button"
            class="btn-primary text-xs py-1.5 px-3"
            @click="promptStatusChange('ON_ROAD')"
          >
            🛣️ Seferi Başlat (Yolda)
          </button>
          <button
            type="button"
            class="btn-secondary text-xs py-1.5 px-3 text-rose-600 hover:bg-rose-50"
            @click="promptStatusChange('CANCELLED')"
          >
            ❌ Seferi İptal Et
          </button>
        </template>

        <!-- ON_ROAD ise: Tamamla veya İptal Et -->
        <template v-else-if="trip.status === 'ON_ROAD'">
          <button
            type="button"
            class="btn-primary text-xs py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800"
            @click="promptStatusChange('COMPLETED')"
          >
            ✅ Seferi Tamamla
          </button>
          <button
            type="button"
            class="btn-secondary text-xs py-1.5 px-3 text-rose-600 hover:bg-rose-50"
            @click="promptStatusChange('CANCELLED')"
          >
            ❌ Seferi İptal Et
          </button>
        </template>

        <!-- COMPLETED veya CANCELLED (Son Durumlar) -->
        <template v-else-if="trip.status === 'COMPLETED'">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ✓ Tamamlandı (Son Durum)
          </span>
        </template>
        <template v-else-if="trip.status === 'CANCELLED'">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            ✕ İptal Edildi (Son Durum)
          </span>
        </template>

        <!-- Seferi Sil Butonu -->
        <button
          type="button"
          class="btn-secondary text-xs py-1.5 px-3 text-rose-600 hover:bg-rose-50 border-rose-200"
          @click="promptDeleteTrip"
        >
          🗑️ Seferi Sil
        </button>
      </div>
    </div>

    <!-- Başarı Bildirimi -->
    <div v-if="successMessage" class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
      <span>{{ successMessage }}</span>
      <button type="button" class="text-xs text-emerald-600 font-bold" @click="successMessage = ''">Kapat</button>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Sefer bilgileri yükleniyor...</p>
    </div>

    <div v-else-if="trip" class="space-y-6">
      <!-- 1. Sefer Başlık & Güzergâh Kartı -->
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-2">
          <div class="flex items-center space-x-3">
            <h1 class="text-2xl font-bold text-slate-900">
              {{ trip.departureLocation }} &rarr; {{ trip.arrivalLocation }}
            </h1>
            <StatusBadge :status="trip.status" />
          </div>

          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>Kalkış: <strong class="text-slate-900">{{ formatDateTime(trip.startsAt) }}</strong></span>
            <span>&bull;</span>
            <span>Varış: <strong class="text-slate-900">{{ formatDateTime(trip.endsAt) }}</strong></span>
            <span v-if="trip.convoy">&bull;</span>
            <span v-if="trip.convoy">Kafile: <strong class="text-slate-900">{{ trip.convoy.name }}</strong></span>
          </div>

          <p v-if="trip.notes" class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-2 inline-block">
            📝 {{ trip.notes }}
          </p>
        </div>

        <!-- Araç ve Şoför Bilgisi Kartı -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 shrink-0 min-w-[260px]">
          <div class="flex items-center justify-between">
            <p class="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Araç ve Şoför Bilgisi</p>
            <button
              type="button"
              class="text-xs font-semibold text-emerald-700 hover:underline"
              @click="openDriverModal"
            >
              Şoförü Düzenle
            </button>
          </div>
          <p>Plaka: <strong class="text-slate-900 text-sm">{{ trip.plateSnapshot }}</strong> ({{ trip.capacitySnapshot }} Kişilik)</p>
          <p>
            Araç Sahibi:
            <NuxtLink :to="`/owners/${trip.ownerId}`" class="font-bold text-emerald-700 hover:underline">
              {{ trip.ownerNameSnapshot }}
            </NuxtLink>
          </p>
          <p>
            Otobüs Şoförü: <strong class="text-slate-900">{{ trip.driverName || 'Belirtilmedi' }}</strong>
          </p>
          <p>
            Şoför Tel:
            <a v-if="trip.driverPhone" :href="`tel:${trip.driverPhone}`" class="font-semibold text-emerald-700 hover:underline">
              📞 {{ trip.driverPhone }}
            </a>
            <span v-else class="text-slate-400">Belirtilmedi</span>
          </p>
          <p class="text-[10px] text-slate-400 italic">
            * Sefer oluşturulurken kaydedilmiş dondurulmuş veridir.
          </p>
        </div>
      </div>

      <!-- 2. Mali Durum ve Özet Kartları -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Anlaşılan Sefer Ücreti -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Anlaşılan Sefer Ücreti</p>
            <button
              v-if="trip.status !== 'CANCELLED'"
              type="button"
              class="text-xs font-semibold text-emerald-700 hover:underline"
              @click="openFeeModal"
            >
              Düzenle
            </button>
          </div>
          <p class="text-2xl font-bold text-slate-900 mt-1">{{ formatMoney(trip.agreedAmount) }}</p>
          <p class="text-[11px] text-slate-400 mt-1">Araç sahibine ödenecek toplam sefer ücreti</p>
        </div>

        <!-- Yapılan Ödemeler Toplamı -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yapılan Ödemeler Toplamı</p>
          <p class="text-2xl font-bold text-emerald-700 mt-1">{{ formatMoney(trip.totalPaid) }}</p>
          <p class="text-[11px] text-slate-400 mt-1">{{ trip.payments.length }} adet ödeme hareketi yapıldı</p>
        </div>

        <!-- Kalan Tutar ve Ödeme Durumu -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kalan Borç Bakiyesi</p>
            <PaymentStatusBadge :status="trip.paymentStatus" />
          </div>
          <p class="text-2xl font-bold mt-1" :class="parseFloat(trip.remainingAmount) > 0 ? 'text-rose-600' : 'text-slate-400'">
            {{ formatMoney(trip.remainingAmount) }}
          </p>
          <p class="text-[11px] text-slate-400 mt-1">
            {{ parseFloat(trip.remainingAmount) === 0 ? 'Tüm borç kapatıldı' : 'Araç sahibine ödenecek bakiye' }}
          </p>
        </div>
      </div>

      <!-- 3. Yapılan Ödemeler Tablosu -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <h2 class="text-base font-bold text-slate-900">Yapılan Ödemeler</h2>
            <span class="text-xs text-slate-400">({{ trip.payments.length }})</span>
          </div>

          <button
            v-if="trip.status !== 'CANCELLED' && parseFloat(trip.remainingAmount) > 0"
            type="button"
            class="btn-primary text-xs py-1.5 px-3"
            @click="openAddPaymentModal"
          >
            <span class="mr-1 font-bold">+</span> Yeni Ödeme Ekle
          </button>
        </div>

        <div v-if="trip.payments.length === 0" class="p-8 text-center text-slate-400 text-sm space-y-2">
          <p>Bu sefere ait henüz bir ödeme kaydedilmemiştir.</p>
          <button
            v-if="trip.status !== 'CANCELLED'"
            type="button"
            class="btn-primary text-xs"
            @click="openAddPaymentModal"
          >
            İlk Ödemeyi Ekle
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-700">
            <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="py-3 px-4">Ödeme Tarihi</th>
                <th class="py-3 px-4">Tutar</th>
                <th class="py-3 px-4">Yöntem</th>
                <th class="py-3 px-4">Açıklama / Not</th>
                <th class="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="payment in trip.payments" :key="payment.id" class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 text-xs font-medium text-slate-900">
                  {{ formatDateTime(payment.paidAt) }}
                </td>
                <td class="py-3 px-4 font-bold text-slate-900 text-sm">
                  {{ formatMoney(payment.amount) }}
                </td>
                <td class="py-3 px-4 text-xs">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded font-medium"
                    :class="payment.method === 'BANK_TRANSFER' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'"
                  >
                    {{ payment.method === 'BANK_TRANSFER' ? '🏦 Banka Havalesi' : '💵 Nakit' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-xs text-slate-500">
                  {{ payment.notes || '-' }}
                </td>
                <td class="py-3 px-4 text-right space-x-2 text-xs">
                  <button
                    type="button"
                    class="font-semibold text-slate-600 hover:text-slate-900"
                    @click="openEditPaymentModal(payment)"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    class="font-semibold text-rose-600 hover:text-rose-700"
                    @click="promptDeletePayment(payment)"
                  >
                    Sil
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Ödeme Ekleme / Düzenleme Modalı -->
    <div
      v-if="isPaymentModalOpen"
      class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isPaymentModalOpen = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
        <h3 class="text-lg font-bold text-slate-900">
          {{ isEditingPayment ? 'Ödemeyi Düzenle' : 'Yeni Ödeme Ekle' }}
        </h3>

        <div v-if="paymentError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {{ paymentError }}
        </div>

        <form class="space-y-4" @submit.prevent="savePayment">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-700">Ödeme Tutarı (TL) *</label>
              <span class="text-[11px] text-slate-400">Kalan Borç: {{ formatMoney(trip?.remainingAmount) }}</span>
            </div>
            <div class="relative">
              <input
                v-model="paymentAmount"
                type="number"
                step="0.01"
                min="0.01"
                required
                class="input-field pr-10 font-bold"
                placeholder="Ör. 5000.00"
              />
              <span class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 font-bold pointer-events-none">
                ₺
              </span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Ödeme Tarih ve Saati *</label>
            <input
              v-model="paymentPaidAt"
              type="datetime-local"
              required
              class="input-field text-sm"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Ödeme Yöntemi *</label>
            <select v-model="paymentMethod" class="input-field text-sm">
              <option value="BANK_TRANSFER">Banka Havalesi / EFT</option>
              <option value="CASH">Nakit</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Açıklama / Dekont Notu</label>
            <textarea
              v-model="paymentNotes"
              rows="2"
              class="input-field"
              placeholder="Dekont no, banka veya ödeme notu..."
            ></textarea>
          </div>

          <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button type="button" class="btn-secondary" :disabled="isPaymentSubmitting" @click="isPaymentModalOpen = false">
              Vazgeç
            </button>
            <button type="submit" class="btn-primary" :disabled="isPaymentSubmitting">
              <span v-if="isPaymentSubmitting" class="mr-2 animate-spin">⏳</span>
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Ücret Düzenleme Modalı -->
    <div
      v-if="isFeeModalOpen"
      class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isFeeModalOpen = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
        <h3 class="text-lg font-bold text-slate-900">Sefer Ücretini Düzenle</h3>

        <div v-if="feeError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {{ feeError }}
        </div>

        <form class="space-y-4" @submit.prevent="updateTripFee">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Yeni Anlaşılan Ücret (TL) *</label>
            <input
              v-model="newAgreedAmount"
              type="number"
              step="0.01"
              min="0"
              required
              class="input-field font-bold"
            />
            <p class="text-[11px] text-slate-400 mt-1">
              * Ücret tutarı, şu ana kadar yapılmış ödemeler toplamından ({{ formatMoney(trip?.totalPaid) }}) daha düşük olamaz.
            </p>
          </div>

          <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button type="button" class="btn-secondary" :disabled="isFeeSubmitting" @click="isFeeModalOpen = false">
              Vazgeç
            </button>
            <button type="submit" class="btn-primary" :disabled="isFeeSubmitting">
              <span v-if="isFeeSubmitting" class="mr-2 animate-spin">⏳</span>
              Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Ödeme Silme Onay Modalı -->
    <ConfirmModal
      :is-open="isDeletePaymentOpen"
      title="Ödeme Kaydını Sil"
      :message="`${formatMoney(paymentToDelete?.amount)} tutarındaki ödemeyi silmek istediğinize emin misiniz? Bu işlem seferin kalan borç bakiyesini artıracaktır.`"
      confirm-text="Ödemeyi Sil"
      :is-danger="true"
      :is-loading="isDeletingPayment"
      @confirm="executeDeletePayment"
      @cancel="isDeletePaymentOpen = false"
    />

    <!-- Durum Güncelleme Onay Modalı -->
    <ConfirmModal
      :is-open="isStatusModalOpen"
      :title="statusModalTitle"
      :message="statusModalMessage"
      confirm-text="Onayla"
      :is-danger="targetStatus === 'CANCELLED'"
      :is-loading="isUpdatingStatus"
      @confirm="executeStatusChange"
      @cancel="isStatusModalOpen = false"
    />

    <!-- Şoför Bilgisi Düzenleme Modalı -->
    <div
      v-if="isDriverModalOpen"
      class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isDriverModalOpen = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
        <h3 class="text-lg font-bold text-slate-900">Şoför Bilgilerini Düzenle</h3>

        <div v-if="driverError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {{ driverError }}
        </div>

        <form @submit.prevent="updateDriverInfo" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Otobüs Şoförü (Ad Soyad)</label>
            <input
              v-model="driverNameInput"
              type="text"
              class="input-field"
              placeholder="Ör. Ahmet Yılmaz"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Şoför Telefon Numarası</label>
            <input
              v-model="driverPhoneInput"
              type="tel"
              class="input-field"
              placeholder="Ör. 0532 123 45 67"
            />
          </div>

          <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button type="button" class="btn-secondary" :disabled="isDriverSubmitting" @click="isDriverModalOpen = false">
              Vazgeç
            </button>
            <button type="submit" class="btn-primary" :disabled="isDriverSubmitting">
              <span v-if="isDriverSubmitting" class="mr-2 animate-spin">⏳</span>
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Seferi Silme Onay Modalı -->
    <ConfirmModal
      :is-open="isDeleteTripOpen"
      title="Seferi Kalıcı Olarak Sil"
      :message="`'${trip?.plateSnapshot}' plakalı seferi ve varsa bu sefere bağlı tüm ödeme kayıtlarını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`"
      confirm-text="Evet, Seferi Sil"
      cancel-text="Vazgeç"
      :is-danger="true"
      :is-loading="isDeletingTrip"
      @confirm="executeDeleteTrip"
      @cancel="isDeleteTripOpen = false"
    />
  </div>
</template>
