export const useApi = () => {
  const { token, logout } = useAuth()

  const apiFetch = async <T = any>(url: string, options: any = {}): Promise<T> => {
    const headers = {
      ...(options.headers || {}),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
    }

    try {
      return (await ($fetch as any)(url, {
        ...options,
        headers,
      })) as T
    } catch (err: any) {
      if (err.statusCode === 401) {
        await logout()
      }
      throw err
    }
  }

  // Para Formatı (tr-TR, TRY)
  const formatMoney = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined || amount === '') return '0,00 ₺'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '0,00 ₺'
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(num)
  }

  // Tarih ve Saat Formatı (İstanbul Saati)
  const formatDateTime = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  const formatDate = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  }

  return {
    apiFetch,
    formatMoney,
    formatDateTime,
    formatDate,
  }
}
