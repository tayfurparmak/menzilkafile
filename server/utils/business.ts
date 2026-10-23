import Decimal from 'decimal.js'
import { TripStatus } from '@prisma/client'

// 1. Plaka Normalizasyonu
export function normalizePlate(plate: string): string {
  if (!plate) return ''
  // Baştaki/sondaki boşlukları al, aradaki ardışık boşlukları tek boşluğa indir, Türkçe harf duyarlı BÜYÜK harfe çevir
  return plate
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('tr-TR')
}

// 2. Geçerli Kapasite Kontrolü (29, 41, 46, 50, 54)
export const VALID_CAPACITIES = [29, 41, 46, 50, 54] as const
export type ValidCapacity = (typeof VALID_CAPACITIES)[number]

export function isValidCapacity(capacity: number): capacity is ValidCapacity {
  return VALID_CAPACITIES.includes(capacity as ValidCapacity)
}

// 3. Decimal ve Para Formatlama Yardımcıları
export function toDecimal(val: Decimal.Value): Decimal {
  try {
    return new Decimal(val)
  } catch {
    throw new Error(`Geçersiz parasal değer: ${val}`)
  }
}

export type PaymentStatusType = 'NO_PAYMENT_REQUIRED' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'

export interface PaymentStatusInfo {
  code: PaymentStatusType
  label: string
  color: string // Tailwind CSS badge color classes
}

export function calculateTripFinancials(agreedAmountVal: Decimal.Value, payments: { amount: Decimal.Value }[]) {
  const agreed = toDecimal(agreedAmountVal)
  const paid = payments.reduce((acc, p) => acc.plus(toDecimal(p.amount)), new Decimal(0))
  const remaining = agreed.minus(paid)

  let status: PaymentStatusInfo

  if (agreed.isZero()) {
    status = {
      code: 'NO_PAYMENT_REQUIRED',
      label: 'Ödeme gerekmiyor',
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  } else if (paid.isZero()) {
    status = {
      code: 'UNPAID',
      label: 'Ödenmedi',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
    }
  } else if (remaining.greaterThan(0)) {
    status = {
      code: 'PARTIALLY_PAID',
      label: 'Kısmi ödendi',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  } else {
    status = {
      code: 'PAID',
      label: 'Tamamı ödendi',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }

  return {
    agreedAmount: agreed.toFixed(2),
    totalPaid: paid.toFixed(2),
    remainingAmount: remaining.toFixed(2),
    status,
  }
}

// 4. Sefer Durum Akışı Kuralları
// PLANNED -> ON_ROAD -> COMPLETED
// PLANNED -> CANCELLED
// ON_ROAD -> CANCELLED
// COMPLETED ve CANCELLED'dan geriye dönüş yok
export function canTransitionTripStatus(currentStatus: TripStatus, targetStatus: TripStatus): boolean {
  if (currentStatus === targetStatus) return true

  switch (currentStatus) {
    case TripStatus.PLANNED:
      return targetStatus === TripStatus.ON_ROAD || targetStatus === TripStatus.CANCELLED
    case TripStatus.ON_ROAD:
      return targetStatus === TripStatus.COMPLETED || targetStatus === TripStatus.CANCELLED
    case TripStatus.COMPLETED:
    case TripStatus.CANCELLED:
      return false
    default:
      return false
  }
}

// 5. Tarih ve Saat Dilimi Yardımcıları (Europe/Istanbul)
// Europe/Istanbul (UTC+3) form datetime-local girdisini UTC Date nesnesine dönüştürür
export function parseIstanbulDateInput(datetimeLocalStr: string): Date {
  if (!datetimeLocalStr) return new Date()
  if (datetimeLocalStr.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(datetimeLocalStr)) {
    return new Date(datetimeLocalStr)
  }
  const normalized = datetimeLocalStr.length === 16 ? `${datetimeLocalStr}:00+03:00` : `${datetimeLocalStr}+03:00`
  return new Date(normalized)
}

// Sunucunun UTC saatinden bağımsız olarak İstanbul yerel gün sınırlarını UTC Date nesnesi olarak üretir
export function getIstanbulDayRange(targetDate: Date = new Date()): { startUtc: Date; endUtc: Date } {
  // 'Europe/Istanbul' UTC+3'tür (gün ışığından yararlanma kalıcı UTC+3)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  
  // yyyy-mm-dd
  const istanbulDateStr = formatter.format(targetDate)
  // İstanbul saatiyle günün başlangıcı: yyyy-mm-ddT00:00:00+03:00
  const startUtc = new Date(`${istanbulDateStr}T00:00:00.000+03:00`)
  // İstanbul saatiyle günün bitişi: yyyy-mm-ddT23:59:59.999+03:00
  const endUtc = new Date(`${istanbulDateStr}T23:59:59.999+03:00`)

  return { startUtc, endUtc }
}

// 6. CSV Formula Injection Koruması ve Hücre Temizleme
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  let str = String(value).trim()

  // Spreadsheet formula injection engeli: =, +, -, @, \t, \r ile başlıyorsa önüne tek tırnak koy
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  // Çift tırnakları escape et
  str = str.replace(/"/g, '""')
  return `"${str}"`
}
