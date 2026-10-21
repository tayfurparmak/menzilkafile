export default defineNuxtRouteMiddleware(async (to) => {
  // Login sayfasına giderken kontrol
  if (to.path === '/login') {
    return
  }

  const { isAuthenticated, token, initAuth } = useAuth()

  // Token yoksa doğrudan login'e yönlendir
  if (!token.value) {
    return navigateTo('/login')
  }

  // İstemcide ilk açılışta oturum henüz senkronize edilmediyse doğrula
  if (import.meta.client && !isAuthenticated.value) {
    await initAuth()
    if (!isAuthenticated.value) {
      return navigateTo('/login')
    }
  }
})
