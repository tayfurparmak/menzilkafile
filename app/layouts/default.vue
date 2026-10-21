<script setup lang="ts">
import { ref } from 'vue'

const { appUser, logout } = useAuth()
const isMobileMenuOpen = ref(false)

const navItems = [
  { name: 'Gösterge Paneli', path: '/', icon: '📊' },
  { name: 'Seferler', path: '/trips', icon: '🛣️' },
  { name: 'Araç Sahipleri', path: '/owners', icon: '👤' },
  { name: 'Otobüsler', path: '/buses', icon: '🚌' },
  { name: 'Kafileler', path: '/convoys', icon: '👥' },
]

const handleLogout = async () => {
  await logout()
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
    <!-- Mobil Üst Bar -->
    <header class="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div class="flex items-center space-x-2">
        <span class="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
          K
        </span>
        <span class="font-bold text-slate-900 tracking-tight">Kafile Yönetimi</span>
      </div>
      <button
        type="button"
        class="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
        @click="isMobileMenuOpen = !isMobileMenuOpen"
      >
        <span class="sr-only">Menüyü aç</span>
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="!isMobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- Mobil Açılır Menü (Drawer) -->
    <div
      v-if="isMobileMenuOpen"
      class="md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
      @click="isMobileMenuOpen = false"
    >
      <div
        class="fixed inset-y-0 left-0 w-64 bg-white p-5 shadow-xl flex flex-col justify-between"
        @click.stop
      >
        <div class="space-y-6">
          <div class="flex items-center space-x-2">
            <span class="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              K
            </span>
            <span class="font-bold text-lg text-slate-900">Kafile Sistemi</span>
          </div>

          <nav class="space-y-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              class="flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
              :class="$route.path === item.path ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
              @click="isMobileMenuOpen = false"
            >
              <span>{{ item.icon }}</span>
              <span>{{ item.name }}</span>
            </NuxtLink>
          </nav>
        </div>

        <div class="pt-4 border-t border-slate-100 space-y-3">
          <div class="px-2">
            <p class="text-xs text-slate-400 font-medium">Aktif Kullanıcı</p>
            <p class="text-sm font-semibold text-slate-800 truncate">{{ appUser?.displayName || 'Yönetici' }}</p>
          </div>
          <button
            type="button"
            class="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
            @click="handleLogout"
          >
            <span>🚪</span>
            <span>Çıkış Yap</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Masaüstü Sol Menü (Sidebar) -->
    <aside class="hidden md:flex md:w-64 flex-col justify-between bg-white border-r border-slate-200 min-h-screen p-5 shrink-0 sticky top-0 h-screen">
      <div class="space-y-6">
        <!-- Logo / Başlık -->
        <div class="flex items-center space-x-3 px-2">
          <div class="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-emerald-200">
            K
          </div>
          <div>
            <h1 class="font-bold text-slate-900 text-base leading-tight">Kafile Yönetimi</h1>
            <p class="text-xs text-slate-400">İç Operasyon Paneli</p>
          </div>
        </div>

        <!-- Navigasyon Linkleri -->
        <nav class="space-y-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
            :class="$route.path === item.path ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
          >
            <span class="text-base">{{ item.icon }}</span>
            <span>{{ item.name }}</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- Kullanıcı ve Çıkış Bölümü -->
      <div class="pt-4 border-t border-slate-100 space-y-3">
        <div class="px-3 py-2 bg-slate-50 rounded-lg flex items-center space-x-3">
          <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
            {{ appUser?.displayName ? appUser.displayName.charAt(0).toUpperCase() : 'U' }}
          </div>
          <div class="overflow-hidden">
            <p class="text-xs text-slate-400">Giriş Yapıldı</p>
            <p class="text-sm font-semibold text-slate-800 truncate">{{ appUser?.displayName || 'Yönetici' }}</p>
          </div>
        </div>

        <button
          type="button"
          class="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
          @click="handleLogout"
        >
          <span>🚪</span>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>

    <!-- Ana İçerik Alanı -->
    <main class="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <slot />
    </main>
  </div>
</template>
