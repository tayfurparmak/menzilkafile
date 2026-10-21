<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const { apiFetch } = useApi()
const route = useRoute()
const router = useRouter()

const buses = ref<any[]>([])
const owners = ref<any[]>([])
const pagination = ref({
  total: 0,
  page: Number(route.query.page) || 1,
  limit: 20,
  totalPages: 1
})
const search = ref((route.query.search as string) || '')
const selectedOwnerId = ref<string>((route.query.ownerId as string) || '')
const selectedCapacity = ref<string>((route.query.capacity as string) || '')
const statusFilter = ref<'all' | 'active' | 'inactive'>((route.query.status as any) || 'all')
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')

// Ekleme / Düzenleme Modal State
const isModalOpen = ref(false)
const isEditing = ref(false)
const targetBusId = ref<string | null>(null)
const formPlate = ref('')
const formCapacity = ref<number>(46)
const formOwnerId = ref('')
const formNotes = ref('')
const formIsActive = ref(true)
const formError = ref('')
const isSubmitting = ref(false)

// Pasife Alma / Silme Onay Modalı
const isConfirmOpen = ref(false)
const confirmTargetBus = ref<any>(null)
const isActionLoading = ref(false)

const syncQuery = () => {
  router.replace({
    query: {
      search: search.value || undefined,
      ownerId: selectedOwnerId.value || undefined,
      capacity: selectedCapacity.value || undefined,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      page: pagination.value.page > 1 ? pagination.value.page : undefined,
    },
  })
}

const fetchBuses = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (search.value) params.append('search', search.value)
    if (selectedOwnerId.value) params.append('ownerId', selectedOwnerId.value)
    if (selectedCapacity.value) params.append('capacity', selectedCapacity.value)
    if (statusFilter.value !== 'all') params.append('status', statusFilter.value)
    params.append('page', pagination.value.page.toString())
    params.append('limit', pagination.value.limit.toString())

    const res = await apiFetch(`/api/buses?${params.toString()}`)
    buses.value = res.items
    pagination.value = res.pagination
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Otobüsler yüklenirken bir hata oluştu.'
  } finally {
    isLoading.value = false
  }
}

const fetchOwnersList = async () => {
  try {
    const res = await apiFetch('/api/owners?limit=100&status=active')
    owners.value = res.items
  } catch (err) {
    console.error('Araç sahipleri listesi alınamadı:', err)
  }
}

let searchTimer: any = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.value.page = 1
    syncQuery()
    fetchBuses()
  }, 300)
})

watch([selectedOwnerId, selectedCapacity, statusFilter], () => {
  pagination.value.page = 1
  syncQuery()
  fetchBuses()
})

const goToPage = (p: number) => {
  pagination.value.page = p
  syncQuery()
  fetchBuses()
}

const resetFilters = () => {
  search.value = ''
  selectedOwnerId.value = ''
  selectedCapacity.value = ''
  statusFilter.value = 'all'
  pagination.value.page = 1
  syncQuery()
  fetchBuses()
}

const openCreateModal = async () => {
  if (owners.value.length === 0) await fetchOwnersList()
  isEditing.value = false
  targetBusId.value = null
  formPlate.value = ''
  formCapacity.value = 46
  formOwnerId.value = selectedOwnerId.value || (owners.value[0]?.id || '')
  formNotes.value = ''
  formIsActive.value = true
  formError.value = ''
  isModalOpen.value = true
}

const openEditModal = async (bus: any) => {
  if (owners.value.length === 0) await fetchOwnersList()
  isEditing.value = true
  targetBusId.value = bus.id
  formPlate.value = bus.plate
  formCapacity.value = bus.capacity
  formOwnerId.value = bus.ownerId
  formNotes.value = bus.notes || ''
  formIsActive.value = bus.isActive
  formError.value = ''
  isModalOpen.value = true
}

const saveBus = async () => {
  if (isSubmitting.value) return
  formError.value = ''
  if (!formPlate.value.trim() || formPlate.value.trim().length < 3) {
    formError.value = 'Lütfen geçerli bir plaka girin (örn. 35 ABC 123).'
    return
  }
  if (!formOwnerId.value) {
    formError.value = 'Lütfen bir araç sahibi seçin.'
    return
  }

  isSubmitting.value = true
  try {
    if (isEditing.value && targetBusId.value) {
      await apiFetch(`/api/buses/${targetBusId.value}`, {
        method: 'PUT',
        body: {
          plate: formPlate.value.trim(),
          capacity: Number(formCapacity.value),
          ownerId: formOwnerId.value,
          notes: formNotes.value.trim() || null,
          isActive: formIsActive.value,
        },
      })
      successMessage.value = 'Otobüs başarıyla güncellendi.'
    } else {
      await apiFetch('/api/buses', {
        method: 'POST',
        body: {
          plate: formPlate.value.trim(),
          capacity: Number(formCapacity.value),
          ownerId: formOwnerId.value,
          notes: formNotes.value.trim() || null,
        },
      })
      successMessage.value = 'Yeni otobüs başarıyla kaydedildi.'
    }
    isModalOpen.value = false
    setTimeout(() => { successMessage.value = '' }, 4000)
    await fetchBuses()
  } catch (err: any) {
    formError.value = err.data?.statusMessage || 'Otobüs kaydedilirken hata oluştu.'
  } finally {
    isSubmitting.value = false
  }
}

const promptToggleActive = (bus: any) => {
  confirmTargetBus.value = bus
  isConfirmOpen.value = true
}

const executeToggleActive = async () => {
  if (!confirmTargetBus.value) return
  isActionLoading.value = true
  try {
    const bus = confirmTargetBus.value
    await apiFetch(`/api/buses/${bus.id}`, {
      method: 'PUT',
      body: { isActive: !bus.isActive },
    })
    isConfirmOpen.value = false
    confirmTargetBus.value = null
    await fetchBuses()
  } catch (err: any) {
    alert(err.data?.statusMessage || 'İşlem başarısız oldu.')
  } finally {
    isActionLoading.value = false
  }
}

// Otobüs Silme
const isDeleteBusOpen = ref(false)
const busToDelete = ref<any>(null)
const isDeletingBus = ref(false)

const promptDeleteBus = (bus: any) => {
  busToDelete.value = bus
  isDeleteBusOpen.value = true
}

const executeDeleteBus = async () => {
  if (!busToDelete.value) return
  isDeletingBus.value = true
  try {
    await apiFetch(`/api/buses/${busToDelete.value.id}`, {
      method: 'DELETE',
    })
    isDeleteBusOpen.value = false
    busToDelete.value = null
    successMessage.value = 'Otobüs başarıyla silindi.'
    await fetchBuses()
  } catch (err: any) {
    alert(err.data?.statusMessage || 'Otobüs silinirken bir hata oluştu.')
  } finally {
    isDeletingBus.value = false
  }
}

onMounted(() => {
  fetchOwnersList()
  fetchBuses()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Başlık ve Ana İşlem Butonu -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Otobüs Yönetimi</h1>
        <p class="text-sm text-slate-500 mt-1">Sistemdeki araçlar, kapasiteleri ve atandıkları araç sahipleri</p>
      </div>
      <button type="button" class="btn-primary" @click="openCreateModal">
        <span class="mr-1.5 font-bold">+</span> Yeni Otobüs Ekle
      </button>
    </div>

    <!-- Başarı Bildirimi -->
    <div v-if="successMessage" class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center space-x-2">
      <span class="text-emerald-600 font-bold">✓</span>
      <span>{{ successMessage }}</span>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Filtre ve Arama Çubuğu -->
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
      <div class="w-full sm:w-64">
        <input
          v-model="search"
          type="text"
          placeholder="Plakaya göre ara..."
          class="input-field text-sm"
        />
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Araç Sahibi Filtresi -->
        <select v-model="selectedOwnerId" class="input-field text-xs py-1.5 w-auto">
          <option value="">Tüm Araç Sahipleri</option>
          <option v-for="owner in owners" :key="owner.id" :value="owner.id">
            {{ owner.name }}
          </option>
        </select>

        <!-- Kapasite Filtresi (41, 46, 54) -->
        <select v-model="selectedCapacity" class="input-field text-xs py-1.5 w-auto">
          <option value="">Tüm Kapasiteler</option>
          <option value="41">41 Kişilik</option>
          <option value="46">46 Kişilik</option>
          <option value="54">54 Kişilik</option>
        </select>

        <!-- Durum Filtresi -->
        <select v-model="statusFilter" class="input-field text-xs py-1.5 w-auto">
          <option value="all">Tüm Durumlar</option>
          <option value="active">Yalnızca Aktifler</option>
          <option value="inactive">Yalnızca Pasifler</option>
        </select>

        <button
          v-if="search || selectedOwnerId || selectedCapacity || statusFilter !== 'all'"
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
      <p>Otobüs kayıtları yükleniyor...</p>
    </div>

    <!-- Boş Liste -->
    <AppEmptyState
      v-else-if="buses.length === 0"
      icon="🚌"
      title="Otobüs Bulunamadı"
      description="Kriterlere uygun kayıt bulunamadı. Yeni bir otobüs kaydederek başlayabilirsiniz."
      actionText="Yeni Otobüs Ekle"
      @action="openCreateModal"
    />

    <!-- Otobüs Listesi -->
    <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Masaüstü Tablo -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th class="py-3.5 px-4">Plaka</th>
              <th class="py-3.5 px-4">Koltuk Kapasitesi</th>
              <th class="py-3.5 px-4">Araç Sahibi</th>
              <th class="py-3.5 px-4">Toplam Sefer</th>
              <th class="py-3.5 px-4">Durum</th>
              <th class="py-3.5 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="bus in buses" :key="bus.id" class="hover:bg-slate-50/80 transition-colors">
              <td class="py-3.5 px-4">
                <NuxtLink :to="`/buses/${bus.id}`" class="font-bold text-slate-900 hover:text-emerald-700 hover:underline">
                  {{ bus.plate }}
                </NuxtLink>
              </td>
              <td class="py-3.5 px-4 font-semibold text-slate-800">
                {{ bus.capacity }} Kişilik
              </td>
              <td class="py-3.5 px-4">
                <NuxtLink :to="`/owners/${bus.ownerId}`" class="font-medium text-slate-900 hover:underline">
                  {{ bus.ownerName }}
                </NuxtLink>
                <span v-if="!bus.isOwnerActive" class="text-xs text-rose-500 block">
                  (Sahip Pasif)
                </span>
              </td>
              <td class="py-3.5 px-4 text-slate-600">{{ bus.tripCount }} sefer</td>
              <td class="py-3.5 px-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                  :class="bus.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
                >
                  {{ bus.isActive ? 'Aktif' : 'Pasif' }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                <NuxtLink
                  :to="`/trips/new?busId=${bus.id}`"
                  class="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                >
                  + Yeni Sefer
                </NuxtLink>
                <NuxtLink :to="`/buses/${bus.id}`" class="text-xs font-semibold text-slate-600 hover:text-slate-900">
                  Detay
                </NuxtLink>
                <button
                  type="button"
                  class="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  @click="openEditModal(bus)"
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  class="text-xs font-semibold"
                  :class="bus.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'"
                  @click="promptToggleActive(bus)"
                >
                  {{ bus.isActive ? 'Pasife Al' : 'Aktifleştir' }}
                </button>
                <button
                  type="button"
                  class="text-xs font-semibold text-rose-600 hover:text-rose-800"
                  @click="promptDeleteBus(bus)"
                >
                  Sil
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobil Kartlar -->
      <div class="md:hidden divide-y divide-slate-100">
        <div v-for="bus in buses" :key="bus.id" class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <NuxtLink :to="`/buses/${bus.id}`" class="font-bold text-slate-900 text-base hover:underline">
                {{ bus.plate }}
              </NuxtLink>
              <p class="text-xs text-slate-500">{{ bus.capacity }} Kişilik | Sahip: {{ bus.ownerName }}</p>
            </div>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
              :class="bus.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'"
            >
              {{ bus.isActive ? 'Aktif' : 'Pasif' }}
            </span>
          </div>

          <div class="flex items-center justify-between pt-1 text-xs">
            <span class="text-slate-500">{{ bus.tripCount }} Sefer Kayıtlı</span>
            <div class="space-x-3">
              <NuxtLink :to="`/trips/new?busId=${bus.id}`" class="font-bold text-emerald-700">
                + Sefer Ver
              </NuxtLink>
              <NuxtLink :to="`/buses/${bus.id}`" class="font-semibold text-slate-700">Detay</NuxtLink>
              <button type="button" class="font-semibold text-slate-600" @click="openEditModal(bus)">Düzenle</button>
              <button
                type="button"
                class="font-semibold"
                :class="bus.isActive ? 'text-amber-600' : 'text-emerald-600'"
                @click="promptToggleActive(bus)"
              >
                {{ bus.isActive ? 'Pasif' : 'Aktif' }}
              </button>
              <button
                type="button"
                class="font-semibold text-rose-600 hover:text-rose-800"
                @click="promptDeleteBus(bus)"
              >
                Sil
              </button>
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

    <!-- Ekleme / Düzenleme Modalı -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isModalOpen = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
        <h3 class="text-lg font-bold text-slate-900">
          {{ isEditing ? 'Otobüsü Düzenle' : 'Yeni Otobüs Ekle' }}
        </h3>

        <div v-if="formError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {{ formError }}
        </div>

        <form class="space-y-4" @submit.prevent="saveBus">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Otobüs Plakası *</label>
            <input
              v-model="formPlate"
              type="text"
              required
              class="input-field uppercase font-bold tracking-wider"
              placeholder="Ör. 35 ABC 123"
            />
            <p class="text-[11px] text-slate-400 mt-1">Plaka sunucuda otomatik normalize edilir ve büyük harfe çevrilir.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Koltuk Kapasitesi *</label>
            <select v-model="formCapacity" class="input-field">
              <option :value="41">41 Kişilik</option>
              <option :value="46">46 Kişilik</option>
              <option :value="54">54 Kişilik</option>
            </select>
            <p class="text-[11px] text-slate-400 mt-1">Yalnızca 41, 46 veya 54 kapasiteli otobüslere izin verilir.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Araç Sahibi *</label>
            <select v-model="formOwnerId" required class="input-field">
              <option value="" disabled>Lütfen bir araç sahibi seçin</option>
              <option v-for="owner in owners" :key="owner.id" :value="owner.id">
                {{ owner.name }} ({{ owner.phone || 'Tel yok' }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Araç Notları</label>
            <textarea
              v-model="formNotes"
              rows="2"
              class="input-field"
              placeholder="Model yılı, marka veya özel operasyon notları..."
            ></textarea>
          </div>

          <div v-if="isEditing" class="flex items-center space-x-2 pt-1">
            <input
              id="isBusActive"
              v-model="formIsActive"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label for="isBusActive" class="text-xs font-medium text-slate-700">Aktif Araç</label>
          </div>

          <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button type="button" class="btn-secondary" :disabled="isSubmitting" @click="isModalOpen = false">
              Vazgeç
            </button>
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="mr-2 animate-spin">⏳</span>
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Onay Modalı -->
    <ConfirmModal
      :is-open="isConfirmOpen"
      :title="confirmTargetBus?.isActive ? 'Otobüsü Pasife Al' : 'Otobüsü Aktifleştir'"
      :message="confirmTargetBus?.isActive
        ? `${confirmTargetBus.plate} plakalı aracı pasife almak üzeresiniz. Pasif otobüslere yeni sefer atanamaz.`
        : `${confirmTargetBus?.plate} plakalı aracı yeniden aktifleştirmek üzeresiniz.`"
      :confirm-text="confirmTargetBus?.isActive ? 'Pasife Al' : 'Aktifleştir'"
      :is-danger="confirmTargetBus?.isActive"
      :is-loading="isActionLoading"
      @confirm="executeToggleActive"
      @cancel="isConfirmOpen = false"
    />

    <!-- Otobüs Silme Onay Modalı -->
    <ConfirmModal
      :is-open="isDeleteBusOpen"
      title="Otobüsü Sil"
      :message="`'${busToDelete?.plate}' plakalı otobüsü silmek istediğinizden emin misiniz? (Not: İlişkili seferleri olan araçlar silinemez, pasife alınabilir).`"
      confirm-text="Evet, Otobüsü Sil"
      cancel-text="Vazgeç"
      :is-danger="true"
      :is-loading="isDeletingBus"
      @confirm="executeDeleteBus"
      @cancel="isDeleteBusOpen = false"
    />
  </div>
</template>
