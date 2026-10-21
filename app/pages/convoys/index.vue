<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const { apiFetch, formatMoney } = useApi()

const convoys = ref<any[]>([])
const pagination = ref({ total: 0, page: 1, limit: 20, totalPages: 1 })
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const isLoading = ref(true)
const errorMessage = ref('')

// Ekleme / Düzenleme Modal State
const isModalOpen = ref(false)
const isEditing = ref(false)
const targetConvoyId = ref<string | null>(null)
const formName = ref('')
const formNotes = ref('')
const formIsActive = ref(true)
const formError = ref('')
const isSubmitting = ref(false)

const fetchConvoys = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (search.value) params.append('search', search.value)
    if (statusFilter.value !== 'all') params.append('status', statusFilter.value)
    params.append('page', pagination.value.page.toString())
    params.append('limit', pagination.value.limit.toString())

    const res = await apiFetch(`/api/convoys?${params.toString()}`)
    convoys.value = res.items
    pagination.value = res.pagination
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Kafileler yüklenirken bir hata oluştu.'
  } finally {
    isLoading.value = false
  }
}

let searchTimer: any = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.value.page = 1
    fetchConvoys()
  }, 300)
})

watch(statusFilter, () => {
  pagination.value.page = 1
  fetchConvoys()
})

const resetFilters = () => {
  search.value = ''
  statusFilter.value = 'all'
  pagination.value.page = 1
  fetchConvoys()
}

const goToPage = (page: number) => {
  if (page < 1 || page > pagination.value.totalPages) return
  pagination.value.page = page
  fetchConvoys()
}

const openCreateModal = () => {
  isEditing.value = false
  targetConvoyId.value = null
  formName.value = ''
  formNotes.value = ''
  formIsActive.value = true
  formError.value = ''
  isModalOpen.value = true
}

const openEditModal = (convoy: any) => {
  isEditing.value = true
  targetConvoyId.value = convoy.id
  formName.value = convoy.name
  formNotes.value = convoy.notes || ''
  formIsActive.value = convoy.isActive
  formError.value = ''
  isModalOpen.value = true
}

const saveConvoy = async () => {
  formError.value = ''
  if (!formName.value.trim() || formName.value.trim().length < 2) {
    formError.value = 'Lütfen geçerli bir kafile adı girin (en az 2 karakter).'
    return
  }

  isSubmitting.value = true
  try {
    if (isEditing.value && targetConvoyId.value) {
      await apiFetch(`/api/convoys/${targetConvoyId.value}`, {
        method: 'PUT',
        body: {
          name: formName.value.trim(),
          notes: formNotes.value.trim() || null,
          isActive: formIsActive.value,
        },
      })
    } else {
      await apiFetch('/api/convoys', {
        method: 'POST',
        body: {
          name: formName.value.trim(),
          notes: formNotes.value.trim() || null,
        },
      })
    }
    isModalOpen.value = false
    await fetchConvoys()
  } catch (err: any) {
    formError.value = err.data?.statusMessage || 'Kaydetme işlemi başarısız oldu.'
  } finally {
    isSubmitting.value = false
  }
}

// Kafile Silme
const isDeleteConvoyOpen = ref(false)
const convoyToDelete = ref<any>(null)
const isDeletingConvoy = ref(false)

const promptDeleteConvoy = (c: any) => {
  convoyToDelete.value = c
  isDeleteConvoyOpen.value = true
}

const executeDeleteConvoy = async () => {
  if (!convoyToDelete.value) return
  isDeletingConvoy.value = true
  try {
    await apiFetch(`/api/convoys/${convoyToDelete.value.id}`, {
      method: 'DELETE',
    })
    isDeleteConvoyOpen.value = false
    convoyToDelete.value = null
    await fetchConvoys()
  } catch (err: any) {
    alert(err.data?.statusMessage || 'Kafile silinirken bir hata oluştu.')
  } finally {
    isDeletingConvoy.value = false
  }
}

onMounted(() => {
  fetchConvoys()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Başlık ve Ana İşlem Butonu -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Kafile Yönetimi</h1>
        <p class="text-sm text-slate-500 mt-1">Grup organizasyonları, bağlı seferler ve toplam kapasite takibi</p>
      </div>
      <button type="button" class="btn-primary" @click="openCreateModal">
        <span class="mr-1.5 font-bold">+</span> Yeni Kafile Ekle
      </button>
    </div>

    <!-- Hata Bildirimi -->
    <div v-if="errorMessage" class="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
      {{ errorMessage }}
    </div>

    <!-- Arama ve Filtre -->
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
      <div class="w-full sm:w-80">
        <input
          v-model="search"
          type="text"
          placeholder="Kafile adına göre ara..."
          class="input-field text-sm"
        />
      </div>

      <div class="flex items-center space-x-2 self-end sm:self-auto">
        <label class="text-xs text-slate-500 font-medium">Durum:</label>
        <select v-model="statusFilter" class="input-field text-sm py-1.5 w-auto">
          <option value="all">Tüm Kafileler</option>
          <option value="active">Sadece Aktifler</option>
          <option value="inactive">Sadece Pasifler</option>
        </select>
        <button
          v-if="search || statusFilter !== 'all'"
          type="button"
          class="text-xs font-semibold text-slate-500 hover:text-slate-800 underline px-2 py-1"
          @click="resetFilters"
        >
          Filtreleri Temizle
        </button>
      </div>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="py-16 text-center text-slate-500">
      <span class="inline-block animate-spin text-3xl mb-2">⏳</span>
      <p>Kafile kayıtları yükleniyor...</p>
    </div>

    <!-- Boş Liste -->
    <AppEmptyState
      v-else-if="convoys.length === 0"
      icon="👥"
      title="Kafile Bulunamadı"
      description="Henüz tanımlanmış bir kafile bulunmuyor. Yeni bir kafile ekleyerek seferlerinizi gruplayabilirsiniz."
      actionText="Yeni Kafile Ekle"
      @action="openCreateModal"
    />

    <!-- Kafile Listesi -->
    <div v-else class="space-y-4">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Masaüstü Tablo -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-700">
            <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="py-3.5 px-4">Kafile Adı</th>
                <th class="py-3.5 px-4">Otobüs / Sefer</th>
                <th class="py-3.5 px-4">
                  Toplam Kapasite
                  <span class="text-[10px] text-slate-400 block normal-case font-normal">(Sefer bazlı koltuk)</span>
                </th>
                <th class="py-3.5 px-4">Toplam Sefer Ücreti</th>
                <th class="py-3.5 px-4">Ödenen</th>
                <th class="py-3.5 px-4">Kalan Borç</th>
                <th class="py-3.5 px-4">Durum</th>
                <th class="py-3.5 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="c in convoys" :key="c.id" class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3.5 px-4 font-bold text-slate-900">
                  <NuxtLink :to="`/convoys/${c.id}`" class="hover:text-emerald-700 hover:underline">
                    {{ c.name }}
                  </NuxtLink>
                  <p v-if="c.notes" class="text-xs text-slate-400 font-normal truncate max-w-xs">{{ c.notes }}</p>
                </td>
                <td class="py-3.5 px-4">
                  <span class="font-medium text-slate-800">{{ c.busCount }} otobüs</span>
                  <span class="text-xs text-slate-400 block">{{ c.tripCount }} sefer</span>
                </td>
                <td class="py-3.5 px-4 font-semibold text-slate-800">
                  {{ c.totalCapacity }} Koltuk Kapasitesi
                </td>
                <td class="py-3.5 px-4 font-medium text-slate-900">{{ formatMoney(c.totalAgreedAmount) }}</td>
                <td class="py-3.5 px-4 font-medium text-emerald-700">{{ formatMoney(c.totalPaidAmount) }}</td>
                <td class="py-3.5 px-4 font-bold" :class="parseFloat(c.totalRemainingAmount) > 0 ? 'text-rose-600' : 'text-slate-400'">
                  {{ formatMoney(c.totalRemainingAmount) }}
                </td>
                <td class="py-3.5 px-4">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                    :class="c.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
                  >
                    {{ c.isActive ? 'Aktif' : 'Pasif' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                  <NuxtLink :to="`/convoys/${c.id}`" class="text-xs font-semibold text-emerald-700 hover:underline">
                    Detay
                  </NuxtLink>
                  <button
                    type="button"
                    class="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    @click="openEditModal(c)"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    class="text-xs font-semibold text-rose-600 hover:text-rose-800"
                    @click="promptDeleteConvoy(c)"
                  >
                    Sil
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobil Kart Görünümü -->
        <div class="md:hidden divide-y divide-slate-100">
          <div v-for="c in convoys" :key="c.id" class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <NuxtLink :to="`/convoys/${c.id}`" class="font-bold text-slate-900 text-base hover:underline">
                {{ c.name }}
              </NuxtLink>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                :class="c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'"
              >
                {{ c.isActive ? 'Aktif' : 'Pasif' }}
              </span>
            </div>

            <p class="text-xs text-slate-500">
              {{ c.busCount }} Otobüs | {{ c.tripCount }} Sefer | {{ c.totalCapacity }} Koltuk Kapasitesi
            </p>

            <div class="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg">
              <div>
                <p class="text-slate-400">Ücret:</p>
                <p class="font-semibold text-slate-800">{{ formatMoney(c.totalAgreedAmount) }}</p>
              </div>
              <div>
                <p class="text-slate-400">Ödenen:</p>
                <p class="font-semibold text-emerald-700">{{ formatMoney(c.totalPaidAmount) }}</p>
              </div>
              <div>
                <p class="text-slate-400">Kalan:</p>
                <p class="font-bold text-rose-600">{{ formatMoney(c.totalRemainingAmount) }}</p>
              </div>
            </div>

            <div class="flex items-center justify-end space-x-3 pt-1 text-xs">
              <NuxtLink :to="`/convoys/${c.id}`" class="font-semibold text-emerald-700">Detay</NuxtLink>
              <button type="button" class="font-semibold text-slate-600" @click="openEditModal(c)">Düzenle</button>
              <button
                type="button"
                class="font-semibold text-rose-600 hover:text-rose-800"
                @click="promptDeleteConvoy(c)"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sayfalama -->
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
          {{ isEditing ? 'Kafileyi Düzenle' : 'Yeni Kafile Ekle' }}
        </h3>

        <div v-if="formError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {{ formError }}
        </div>

        <form class="space-y-4" @submit.prevent="saveConvoy">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Kafile Adı *</label>
            <input
              v-model="formName"
              type="text"
              required
              class="input-field"
              placeholder="Ör. 2026 Kasım Kafilesi veya Konya Kültür Turu"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Notlar / Açıklama</label>
            <textarea
              v-model="formNotes"
              rows="3"
              class="input-field"
              placeholder="Kafileyle ilgili özel ayrıntılar veya güzergâh açıklaması..."
            ></textarea>
          </div>

          <div v-if="isEditing" class="flex items-center space-x-2 pt-1">
            <input
              id="isConvoyActive"
              v-model="formIsActive"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label for="isConvoyActive" class="text-xs font-medium text-slate-700">Aktif Kafile</label>
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

    <!-- Kafile Silme Onay Modalı -->
    <ConfirmModal
      :is-open="isDeleteConvoyOpen"
      title="Kafileyi Sil"
      :message="`'${convoyToDelete?.name}' adlı kafileyi silmek istediğinizden emin misiniz? (Not: Bağlı seferleri olan kafileler silinemez, pasife alınabilir).`"
      confirm-text="Evet, Kafileyi Sil"
      cancel-text="Vazgeç"
      :is-danger="true"
      :is-loading="isDeletingConvoy"
      @confirm="executeDeleteConvoy"
      @cancel="isDeleteConvoyOpen = false"
    />
  </div>
</template>
