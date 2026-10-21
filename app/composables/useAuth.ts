import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export interface AppUserProfile {
  id: string
  displayName: string
  email?: string
  isActive: boolean
}

let supabaseInstance: SupabaseClient | null = null

export const useSupabase = () => {
  const config = useRuntimeConfig()
  if (!supabaseInstance) {
    const url = config.public.supabaseUrl || 'https://placeholder.supabase.co'
    const key = config.public.supabaseAnonKey || 'placeholder_anon_key'
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return supabaseInstance
}

export const useAuth = () => {
  const tokenCookie = useCookie<string | null>('sb-access-token', {
    maxAge: 60 * 60 * 24 * 7, // 7 gün
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  const user = useState<User | null>('auth_user', () => null)
  const appUser = useState<AppUserProfile | null>('auth_app_user', () => null)
  const isLoading = useState<boolean>('auth_loading', () => false)

  const token = computed(() => tokenCookie.value)
  const isAuthenticated = computed(() => !!token.value && !!appUser.value && appUser.value.isActive)

  const syncAppUser = async (accessToken: string) => {
    try {
      const response = await $fetch<{ success: boolean; user: AppUserProfile }>('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response && response.user) {
        appUser.value = response.user
        return response.user
      }
    } catch (err: any) {
      console.error('AppUser doğrulama hatası:', err)
      appUser.value = null
      tokenCookie.value = null
      throw err
    }
    return null
  }

  const login = async (email: string, password: string) => {
    isLoading.value = true
    try {
      // 1. Sunucu auth uç noktasından doğrula
      const response = await $fetch<{ success: boolean; token: string; user: AppUserProfile }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      if (response && response.token) {
        tokenCookie.value = response.token
        appUser.value = response.user
        return { success: true }
      }
      throw new Error('Giriş oturumu oluşturulamadı.')
    } catch (err: any) {
      throw new Error(err.data?.statusMessage || err.message || 'E-posta adresi veya parola hatalı.')
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    isLoading.value = true
    try {
      const supabase = useSupabase()
      await supabase.auth.signOut().catch(() => {})
    } finally {
      tokenCookie.value = null
      user.value = null
      appUser.value = null
      isLoading.value = false
      navigateTo('/login')
    }
  }

  const initAuth = async () => {
    if (import.meta.server) return

    // Eğer cookie'de token varsa oturumu doğrula
    if (tokenCookie.value && !appUser.value) {
      isLoading.value = true
      try {
        await syncAppUser(tokenCookie.value)
      } catch {
        tokenCookie.value = null
        appUser.value = null
      } finally {
        isLoading.value = false
      }
    }
  }

  return {
    user,
    appUser,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    initAuth,
    syncAppUser,
  }
}
