<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const { apiFetch, formatMoney } = useApi()
const route = useRoute()

const buses = ref<any[]>([])
const convoys = ref<any[]>([])
const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')

// Form Alanları
const selectedBusId = ref<string>((route.query.busId as string) || '')
const selectedConvoyId = ref<string>((route.query.convoyId as string) || '')
const departureLocation = ref('İzmir')
const arrivalLocation = ref('Konya')
const startsAt = ref('')
const endsAt = ref('')
const agreedAmount = ref('18000')
const notes = ref('')

// Seçili Otobüs ve Snapshot Önizlemesi
const selectedBus = computed(() => {
  return buses.value.find((b) => b.id === selectedBusId.value) || null
})

// Varsayılan saatleri ayarla (Yarın 08:00 - 18:00)
const setDefaultTimes = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const yyyy = tomorrow.getFullYear()
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const dd = String(tomorrow.getDate()).padStart(2, '0')
  
  startsAt.value = `${yyyy}-${mm}-${dd}T08:00`
  endsAt.value = `${yyyy}-${mm}-${dd}T18:00`
}

const loadData = async () => {
  isLoading.value = true
  try {
    const [busesRes, convoysRes] = await Promise.all([
      apiFetch('/api/buses?status=active&limit=100'),
      apiFetch('/api/convoys?status=active&limit=100'),
    ])
    buses.value = busesRes.items
    convoys.value = convoysRes.items

    if (route.query.busId) {
      selectedBusId.value = route.query.busId as string
    } else if (!selectedBusId.value && buses.value.length > 0) {
      selectedBusId.value = buses.value[0].id
    }
    setDefaultTimes()
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Veriler yüklenirken hata oluştu.'
  } finally {
    isLoading.value = false
  }
}

const createTrip = async () => {
  errorMessage.value = ''
  if (!selectedBusId.value) {
    errorMessage.value = 'Lütfen bir otobüs seçin.'
    return
  }
  if (!departureLocation.value.trim() || !arrivalLocation.value.trim()) {
    errorMessage.value = 'Kalkış ve varış yerleri zorunludur.'
    return
  }
  if (!startsAt.value || !endsAt.value) {
    errorMessage.value = 'Başlangıç ve bitiş tarihleri zorunludur.'
    return
  }

  const parseIstanbulToUtc = (val: string) => {
    if (!val) return new Date()
    const normalized = val.length === 16 ? `${val}:00+03:00` : (val.includes('+') ? val : `${val}+03:00`)
    return new Date(normalized)
  }

  const startDateObj = parseIstanbulToUtc(startsAt.value)
  const endDateObj = parseIstanbulToUtc(endsAt.value)

  if (endDateObj <= startDateObj) {
    errorMessage.value = 'Sefer bitiş zamanı, başlangıç zamanından sonra olmalıdır.'
    return
  }

  const amountNum = parseFloat(agreedAmount.value)
  if (isNaN(amountNum) || amountNum < 0) {
    errorMessage.value = 'Lütfen geçerli bir anlaşılan toplam ücret tutarı girin.'
    return
  }

  isSubmitting.value = true
  try {
    const res = await apiFetch('/api/trips', {
      method: 'POST',
      body: {
        busId: selectedBusId.value,
        convoyId: selectedConvoyId.value || null,
        departureLocation: departureLocation.value.trim(),
        arrivalLocation: arrivalLocation.value.trim(),
        startsAt: startDateObj.toISOString(),
        endsAt: endDateObj.toISOString(),
        agreedAmount: agreedAmount.value.toString(),
        notes: notes.value.trim() || null,
      },
    })

    if (res?.data?.id) {
      await navigateTo(`/trips/${res.data.id}`)
    } else {
      await navigateTo('/trips')
    }
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Sefer oluşturulurken bir hata oluştu.'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Üst Bar -->
    <div class="flex items-center justify-between">
      <NuxtLink to="/trips" class="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1">
        <span>&larr;</span> <span>Sefer Listesine Dön</span>
      </NuxtLink>
    </div>

    <!-- Başlık -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Yeni Sefer Oluştur</h1>
      <p class="text-sm text-slate-500 mt-1">
        Otobüs, kafile, güzergâh ve araç sahibine ödenecek toplam sefer ücretini tanımlayın.
      </p>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-start space-x-2">
      <span class="text-base leading-none">⚠️</span>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Gerekli veriler yükleniyor...</p>
    </div>

    <!-- Form -->
    <form v-else class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6" @submit.prevent="createTrip">
      <!-- 1. Otobüs Seçimi ve Snapshot Önizlemesi -->
      <div class="space-y-3 pb-6 border-b border-slate-100">
        <h2 class="text-base font-bold text-slate-900">1. Araç ve Sahip Bilgisi</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Görevlendirilecek Otobüs *</label>
            <select v-model="selectedBusId" required class="input-field">
              <option value="" disabled>Lütfen bir otobüs seçin</option>
              <option v-for="b in buses" :key="b.id" :value="b.id">
                {{ b.plate }} ({{ b.capacity }} Kişilik - {{ b.ownerName }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Dahil Olduğu Kafile (İsteğe Bağlı)</label>
            <select v-model="selectedConvoyId" class="input-field">
              <option value="">Bağımsız Sefer (Kafile Yok)</option>
              <option v-for="c in convoys" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Snapshot Bilgi Kutusu -->
        <div v-if="selectedBus" class="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3.5 text-xs text-slate-700 space-y-1">
          <p class="font-bold text-emerald-800">📸 Sunucu Tarihsel Snapshot Bilgisi:</p>
          <p>
            Plaka: <span class="font-bold text-slate-900">{{ selectedBus.plate }}</span> |
            Kapasite: <span class="font-bold text-slate-900">{{ selectedBus.capacity }} Kişilik</span> |
            Araç Sahibi: <span class="font-bold text-slate-900">{{ selectedBus.ownerName }}</span>
          </p>
          <p class="text-[11px] text-emerald-700">
            * Sefer oluşturulduğunda bu bilgiler dondurulur; ileride otobüsün sahibi değişse bile bu seferin geçmiş sahibi ve mali kayıtları korunur.
          </p>
        </div>
      </div>

      <!-- 2. Güzergâh ve Tarih Bilgisi -->
      <div class="space-y-4 pb-6 border-b border-slate-100">
        <h2 class="text-base font-bold text-slate-900">2. Güzergâh ve Sefer Zamanı</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Kalkış Yeri *</label>
            <input
              v-model="departureLocation"
              type="text"
              required
              class="input-field"
              placeholder="Ör. İzmir Otogar"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Varış Yeri *</label>
            <input
              v-model="arrivalLocation"
              type="text"
              required
              class="input-field"
              placeholder="Ör. Konya Mevlana Meydanı"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Başlangıç Tarih ve Saati *</label>
            <input
              v-model="startsAt"
              type="datetime-local"
              required
              class="input-field"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Bitiş Tarih ve Saati *</label>
            <input
              v-model="endsAt"
              type="datetime-local"
              required
              class="input-field"
            />
          </div>
        </div>
        <p class="text-[11px] text-slate-400">
          * Sistem bu saat aralığında seçilen otobüsün çakışan başka bir aktif seferi olup olmadığını otomatik denetler.
        </p>
      </div>

      <!-- 3. Mali Anlaşma ve Notlar -->
      <div class="space-y-4">
        <h2 class="text-base font-bold text-slate-900">3. Mali Anlaşma ve Notlar</h2>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">
            Anlaşılan Toplam Sefer Ücreti (TL) *
          </label>
          <div class="relative max-w-xs">
            <input
              v-model="agreedAmount"
              type="number"
              step="0.01"
              min="0"
              required
              class="input-field pr-10 font-bold text-base"
              placeholder="18000.00"
            />
            <span class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 font-bold text-sm pointer-events-none">
              ₺
            </span>
          </div>
          <p class="text-[11px] text-slate-400 mt-1">
            * Koltuk başına değil; otobüsün bu seferi için araç sahibine ödenecek toplam tutardır.
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Sefer Notları (İsteğe Bağlı)</label>
          <textarea
            v-model="notes"
            rows="3"
            class="input-field"
            placeholder="Şoför bilgisi, mola yerleri veya özel operasyon talimatları..."
          ></textarea>
        </div>
      </div>

      <!-- Gönder Butonları -->
      <div class="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
        <NuxtLink to="/trips" class="btn-secondary">
          Vazgeç
        </NuxtLink>
        <button
          type="submit"
          class="btn-primary px-6 py-2.5 font-bold shadow-sm"
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting" class="mr-2 animate-spin">⏳</span>
          {{ isSubmitting ? 'Sefer Oluşturuluyor...' : 'Seferi Kaydet ve Başlat' }}
        </button>
      </div>
    </form>
  </div>
</template>
