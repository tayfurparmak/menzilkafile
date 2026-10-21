<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const { apiFetch, formatMoney } = useApi()
const route = useRoute()
const router = useRouter()

const owners = ref<any[]>([])
const pagination = ref({
  total: 0,
  page: Number(route.query.page) || 1,
  limit: 20,
  totalPages: 1
})
const search = ref((route.query.search as string) || '')
const statusFilter = ref<'all' | 'active' | 'inactive'>((route.query.status as any) || 'all')
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')

// Ekleme / Düzenleme Modal State
const isModalOpen = ref(false)
const isEditing = ref(false)
const selectedOwnerId = ref<string | null>(null)
const formName = ref('')
const formPhone = ref('')
const formNotes = ref('')
const formIsActive = ref(true)
const formError = ref('')
const isSubmitting = ref(false)

// Pasife Alma / Silme Onay Modal State
const isConfirmOpen = ref(false)
const confirmTargetOwner = ref<any>(null)
const isDeleting = ref(false)

const syncQuery = () => {
  router.replace({
    query: {
      search: search.value || undefined,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      page: pagination.value.page > 1 ? pagination.value.page : undefined,
    },
  })
}

const fetchOwners = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (search.value) params.append('search', search.value)
    if (statusFilter.value !== 'all') params.append('status', statusFilter.value)
    params.append('page', pagination.value.page.toString())
    params.append('limit', pagination.value.limit.toString())

    const res = await apiFetch(`/api/owners?${params.toString()}`)
    owners.value = res.items
    pagination.value = res.pagination
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Araç sahipleri listelenirken bir hata oluştu.'
  } finally {
    isLoading.value = false
  }
}

let searchTimer: any = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.value.page = 1
    syncQuery()
    fetchOwners()
  }, 300)
})

watch(statusFilter, () => {
  pagination.value.page = 1
  syncQuery()
  fetchOwners()
})

const goToPage = (p: number) => {
  pagination.value.page = p
  syncQuery()
  fetchOwners()
}

const resetFilters = () => {
  search.value = ''
  statusFilter.value = 'all'
  pagination.value.page = 1
  syncQuery()
  fetchOwners()
}

const openCreateModal = () => {
  isEditing.value = false
  selectedOwnerId.value = null
  formName.value = ''
  formPhone.value = ''
  formNotes.value = ''
  formIsActive.value = true
  formError.value = ''
  isModalOpen.value = true
}

const openEditModal = (owner: any) => {
  isEditing.value = true
  selectedOwnerId.value = owner.id
  formName.value = owner.name
  formPhone.value = owner.phone || ''
  formNotes.value = owner.notes || ''
  formIsActive.value = owner.isActive
  formError.value = ''
  isModalOpen.value = true
}

const saveOwner = async () => {
  if (isSubmitting.value) return
  formError.value = ''
  if (!formName.value.trim() || formName.value.trim().length < 2) {
    formError.value = 'Lütfen geçerli bir araç sahibi adı girin (en az 2 karakter).'
    return
  }

  isSubmitting.value = true
  try {
    if (isEditing.value && selectedOwnerId.value) {
      await apiFetch(`/api/owners/${selectedOwnerId.value}`, {
        method: 'PUT',
        body: {
          name: formName.value.trim(),
          phone: formPhone.value.trim() || null,
          notes: formNotes.value.trim() || null,
          isActive: formIsActive.value,
        },
      })
      successMessage.value = 'Araç sahibi başarıyla güncellendi.'
    } else {
      await apiFetch('/api/owners', {
        method: 'POST',
        body: {
          name: formName.value.trim(),
          phone: formPhone.value.trim() || null,
          notes: formNotes.value.trim() || null,
        },
      })
      successMessage.value = 'Yeni araç sahibi başarıyla kaydedildi.'
    }
    isModalOpen.value = false
    setTimeout(() => { successMessage.value = '' }, 4000)
    await fetchOwners()
  } catch (err: any) {
    formError.value = err.data?.statusMessage || 'Kaydetme işlemi başarısız oldu.'
  } finally {
    isSubmitting.value = false
  }
}

const promptToggleActive = (owner: any) => {
  confirmTargetOwner.value = owner
  isConfirmOpen.value = true
}

const executeToggleActive = async () => {
  if (!confirmTargetOwner.value) return
  isDeleting.value = true
  try {
    const owner = confirmTargetOwner.value
    // Aktiflik durumunu tersine çevir
    await apiFetch(`/api/owners/${owner.id}`, {
      method: 'PUT',
      body: { isActive: !owner.isActive },
    })
    isConfirmOpen.value = false
    confirmTargetOwner.value = null
    await fetchOwners()
  } catch (err: any) {
    alert(err.data?.statusMessage || 'İşlem başarısız oldu.')
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => {
  fetchOwners()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Başlık ve Ana Buton -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Araç Sahipleri</h1>
        <p class="text-sm text-slate-500 mt-1">Otobüs sahiplerinin kayıtları, araçları ve mali hesapları</p>
      </div>
      <button type="button" class="btn-primary" @click="openCreateModal">
        <span class="mr-1.5 font-bold">+</span> Yeni Araç Sahibi Ekle
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

    <!-- Arama ve Filtre Çubuğu -->
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
      <div class="w-full sm:w-80">
        <input
          v-model="search"
          type="text"
          placeholder="İsim veya telefon ile ara..."
          class="input-field text-sm"
        />
      </div>

      <div class="flex items-center space-x-3 self-end sm:self-auto">
        <div class="flex items-center space-x-2">
          <label class="text-xs text-slate-500 font-medium">Durum:</label>
          <select v-model="statusFilter" class="input-field text-sm py-1.5 w-auto">
            <option value="all">Tümü</option>
            <option value="active">Sadece Aktifler</option>
            <option value="inactive">Sadece Pasifler</option>
          </select>
        </div>
        <button
          v-if="search || statusFilter !== 'all'"
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
      <p>Araç sahipleri yükleniyor...</p>
    </div>

    <!-- Boş Liste -->
    <AppEmptyState
      v-else-if="owners.length === 0"
      icon="👤"
      title="Kayıt Bulunamadı"
      description="Arama kriterlerinize uygun araç sahibi bulunamadı. Yeni bir araç sahibi ekleyerek başlayabilirsiniz."
      actionText="Yeni Araç Sahibi Ekle"
      @action="openCreateModal"
    />

    <!-- Liste Tablosu / Kart Düzeni -->
    <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Masaüstü Tablo -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th class="py-3.5 px-4">Araç Sahibi / Firma</th>
              <th class="py-3.5 px-4">Telefon</th>
              <th class="py-3.5 px-4">Otobüsler</th>
              <th class="py-3.5 px-4">Sefer Sayısı</th>
              <th class="py-3.5 px-4">Toplam Hakediş</th>
              <th class="py-3.5 px-4">Ödenen</th>
              <th class="py-3.5 px-4">Kalan Borç</th>
              <th class="py-3.5 px-4">Durum</th>
              <th class="py-3.5 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="owner in owners" :key="owner.id" class="hover:bg-slate-50/80 transition-colors">
              <td class="py-3.5 px-4 font-semibold text-slate-900">
                <NuxtLink :to="`/owners/${owner.id}`" class="hover:text-emerald-700 hover:underline">
                  {{ owner.name }}
                </NuxtLink>
              </td>
              <td class="py-3.5 px-4 text-slate-600">{{ owner.phone || '-' }}</td>
              <td class="py-3.5 px-4">
                <span class="font-medium text-slate-800">{{ owner.activeBusCount }}</span>
                <span class="text-xs text-slate-400"> / {{ owner.busCount }} aktif</span>
              </td>
              <td class="py-3.5 px-4 text-slate-600">{{ owner.tripCount }} sefer</td>
              <td class="py-3.5 px-4 font-medium text-slate-900">{{ formatMoney(owner.totalAgreedAmount) }}</td>
              <td class="py-3.5 px-4 font-medium text-emerald-700">{{ formatMoney(owner.totalPaidAmount) }}</td>
              <td class="py-3.5 px-4 font-bold" :class="parseFloat(owner.totalRemainingAmount) > 0 ? 'text-rose-600' : 'text-slate-400'">
                {{ formatMoney(owner.totalRemainingAmount) }}
              </td>
              <td class="py-3.5 px-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                  :class="owner.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
                >
                  {{ owner.isActive ? 'Aktif' : 'Pasif' }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                <NuxtLink :to="`/owners/${owner.id}`" class="text-xs font-semibold text-emerald-700 hover:underline">
                  Detay
                </NuxtLink>
                <button
                  type="button"
                  class="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  @click="openEditModal(owner)"
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  class="text-xs font-semibold"
                  :class="owner.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'"
                  @click="promptToggleActive(owner)"
                >
                  {{ owner.isActive ? 'Pasife Al' : 'Aktifleştir' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobil Kart Görünümü -->
      <div class="md:hidden divide-y divide-slate-100">
        <div v-for="owner in owners" :key="owner.id" class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <NuxtLink :to="`/owners/${owner.id}`" class="font-bold text-slate-900 text-base hover:underline">
              {{ owner.name }}
            </NuxtLink>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
              :class="owner.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'"
            >
              {{ owner.isActive ? 'Aktif' : 'Pasif' }}
            </span>
          </div>

          <p class="text-xs text-slate-500">Tel: {{ owner.phone || '-' }} | {{ owner.activeBusCount }} Aktif Araç</p>

          <div class="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg">
            <div>
              <p class="text-slate-400">Hakediş:</p>
              <p class="font-semibold text-slate-800">{{ formatMoney(owner.totalAgreedAmount) }}</p>
            </div>
            <div>
              <p class="text-slate-400">Ödenen:</p>
              <p class="font-semibold text-emerald-700">{{ formatMoney(owner.totalPaidAmount) }}</p>
            </div>
            <div>
              <p class="text-slate-400">Kalan:</p>
              <p class="font-bold text-rose-600">{{ formatMoney(owner.totalRemainingAmount) }}</p>
            </div>
          </div>

          <div class="flex items-center justify-end space-x-3 pt-1 text-xs">
            <NuxtLink :to="`/owners/${owner.id}`" class="font-semibold text-emerald-700">Detay</NuxtLink>
            <button type="button" class="font-semibold text-slate-600" @click="openEditModal(owner)">Düzenle</button>
            <button
              type="button"
              class="font-semibold"
              :class="owner.isActive ? 'text-amber-600' : 'text-emerald-600'"
              @click="promptToggleActive(owner)"
            >
              {{ owner.isActive ? 'Pasife Al' : 'Aktifleştir' }}
            </button>
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
          {{ isEditing ? 'Araç Sahibini Düzenle' : 'Yeni Araç Sahibi Ekle' }}
        </h3>

        <div v-if="formError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {{ formError }}
        </div>

        <form class="space-y-4" @submit.prevent="saveOwner">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Kişi veya Firma Adı *</label>
            <input
              v-model="formName"
              type="text"
              required
              class="input-field"
              placeholder="Ör. Mehmet Yılmaz veya Güven Turizm"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Telefon Numarası</label>
            <input
              v-model="formPhone"
              type="tel"
              class="input-field"
              placeholder="05XX XXX XX XX"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Notlar</label>
            <textarea
              v-model="formNotes"
              rows="3"
              class="input-field"
              placeholder="Araç sahibi hakkında operasyonel notlar..."
            ></textarea>
          </div>

          <div v-if="isEditing" class="flex items-center space-x-2 pt-1">
            <input
              id="isActiveCheck"
              v-model="formIsActive"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label for="isActiveCheck" class="text-xs font-medium text-slate-700">Aktif Kayıt</label>
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
      :title="confirmTargetOwner?.isActive ? 'Araç Sahibini Pasife Al' : 'Araç Sahibini Aktifleştir'"
      :message="confirmTargetOwner?.isActive
        ? `${confirmTargetOwner.name} kaydını pasife almak üzeresiniz. Pasif araç sahiplerine yeni otobüs veya yeni sefer atanamaz.`
        : `${confirmTargetOwner?.name} kaydını yeniden aktifleştirmek üzeresiniz.`"
      :confirm-text="confirmTargetOwner?.isActive ? 'Pasife Al' : 'Aktifleştir'"
      :is-danger="confirmTargetOwner?.isActive"
      :is-loading="isDeleting"
      @confirm="executeToggleActive"
      @cancel="isConfirmOpen = false"
    />
  </div>
</template>
