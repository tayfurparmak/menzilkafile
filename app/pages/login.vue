<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: false,
})

const { login, isAuthenticated } = useAuth()

// Zaten oturumu varsa ana sayfaya yönlendir
if (isAuthenticated.value) {
  navigateTo('/')
}

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const handleLogin = async () => {
  errorMessage.value = ''
  if (!username.value || !password.value) {
    errorMessage.value = 'Lütfen kullanıcı adınızı ve şifrenizi girin.'
    return
  }

  isSubmitting.value = true
  try {
    await login(username.value, password.value)
    await navigateTo('/')
  } catch (err: any) {
    errorMessage.value = err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6">
      <!-- Logo ve Başlık -->
      <div class="text-center space-y-2">
        <div class="w-12 h-12 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-white text-xl font-bold shadow-md shadow-emerald-200">
          K
        </div>
        <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Kafile Yönetim Sistemi</h2>
        <p class="text-sm text-slate-500">Yetkili iç yönetim paneline giriş yapın</p>
      </div>

      <!-- Hata Mesajı -->
      <div
        v-if="errorMessage"
        class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-start space-x-2"
      >
        <span class="text-base leading-none">⚠️</span>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Giriş Formu -->
      <form class="space-y-4" @submit.prevent="handleLogin">
        <div>
          <label for="username" class="block text-sm font-medium text-slate-700 mb-1">Kullanıcı Adı</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            autocomplete="username"
            class="input-field"
            placeholder="kafile12"
            :disabled="isSubmitting"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="input-field"
            placeholder="••••••••"
            :disabled="isSubmitting"
          />
        </div>

        <button
          type="submit"
          class="w-full btn-primary py-2.5 text-base font-semibold shadow-sm"
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting" class="mr-2 animate-spin">⏳</span>
          <span>{{ isSubmitting ? 'Giriş Yapılıyor...' : 'Giriş Yap' }}</span>
        </button>
      </form>

      <div class="pt-4 border-t border-slate-100 text-center">
        <p class="text-xs text-slate-400">
          Herkese açık kayıt kapalıdır. Yetkilendirme için sistem yöneticisiyle iletişime geçin.
        </p>
      </div>
    </div>
  </div>
</template>
