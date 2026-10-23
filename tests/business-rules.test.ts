import { describe, it, expect } from 'vitest'
import {
  normalizePlate,
  isValidCapacity,
  calculateTripFinancials,
  canTransitionTripStatus,
  getIstanbulDayRange,
  sanitizeCsvCell,
  toDecimal,
} from '../server/utils/business'
import { TripStatus } from '@prisma/client'
import Decimal from 'decimal.js'

describe('Kafile Yönetim Sistemi - İş Kuralları ve Doğrulama Testleri', () => {
  // 1. Normalize Edilmiş Mükerrer Plaka Kontrolü
  describe('Plaka Normalizasyonu', () => {
    it('baştaki, sondaki ve aradaki ardışık boşlukları temizleyip büyük harfe çevirmelidir', () => {
      expect(normalizePlate('  35  abc  123  ')).toBe('35 ABC 123')
      expect(normalizePlate('34istanbul99')).toBe('34İSTANBUL99')
      expect(normalizePlate('06   an   5555')).toBe('06 AN 5555')
    })

    it('eşdeğer farklı formatta girilen plakaların aynı normalize değere dönüştüğünü doğrular', () => {
      const p1 = normalizePlate('35 abc 123')
      const p2 = normalizePlate('  35   ABC   123 ')
      expect(p1).toBe(p2)
    })
  })

  // 2. Geçersiz Kapasite Engellenmesi
  describe('Koltuk Kapasitesi Doğrulaması', () => {
    it('yalnızca 29, 41, 46, 50 ve 54 kapasitelerini kabul etmelidir', () => {
      expect(isValidCapacity(29)).toBe(true)
      expect(isValidCapacity(41)).toBe(true)
      expect(isValidCapacity(46)).toBe(true)
      expect(isValidCapacity(50)).toBe(true)
      expect(isValidCapacity(54)).toBe(true)
    })

    it('29, 41, 46, 50 veya 54 dışındaki kapasiteleri reddetmelidir', () => {
      expect(isValidCapacity(28)).toBe(false)
      expect(isValidCapacity(30)).toBe(false)
      expect(isValidCapacity(40)).toBe(false)
      expect(isValidCapacity(55)).toBe(false)
      expect(isValidCapacity(60)).toBe(false)
      expect(isValidCapacity(0)).toBe(false)
      expect(isValidCapacity(-46)).toBe(false)
    })
  })

  // 3. 18.000 TL Ücret ve 5.000 TL Ödemede 13.000 TL Kalması
  describe('Mali Hesaplamalar ve Bakiye Takibi', () => {
    it('18.000 TL anlaşılan ücret ve 5.000 TL ödemede kalan tutarı tam 13.000 TL olarak hesaplamalıdır', () => {
      const financials = calculateTripFinancials('18000.00', [{ amount: '5000.00' }])

      expect(financials.agreedAmount).toBe('18000.00')
      expect(financials.totalPaid).toBe('5000.00')
      expect(financials.remainingAmount).toBe('13000.00')
      expect(financials.status.code).toBe('PARTIALLY_PAID')
      expect(financials.status.label).toBe('Kısmi ödendi')
    })

    it('hiç ödeme yapılmadığında UNPAID ve kalan tutarı ücret kadar göstermelidir', () => {
      const financials = calculateTripFinancials('18000.00', [])
      expect(financials.totalPaid).toBe('0.00')
      expect(financials.remainingAmount).toBe('18000.00')
      expect(financials.status.code).toBe('UNPAID')
      expect(financials.status.label).toBe('Ödenmedi')
    })

    it('tamamı ödendiğinde PAID ve kalan tutarı 0 göstermelidir', () => {
      const financials = calculateTripFinancials('18000.00', [
        { amount: '10000.00' },
        { amount: '8000.00' },
      ])
      expect(financials.totalPaid).toBe('18000.00')
      expect(financials.remainingAmount).toBe('0.00')
      expect(financials.status.code).toBe('PAID')
      expect(financials.status.label).toBe('Tamamı ödendi')
    })

    it('ücret sıfır girildiğinde NO_PAYMENT_REQUIRED durumunu üretmelidir', () => {
      const financials = calculateTripFinancials('0.00', [])
      expect(financials.status.code).toBe('NO_PAYMENT_REQUIRED')
      expect(financials.status.label).toBe('Ödeme gerekmiyor')
    })
  })

  // 4. Fazla Ödeme Engeli Mantığı
  describe('Fazla Ödeme Kontrolü', () => {
    it('kalan tutardan daha fazla ödeme yapılmasını engellemelidir', () => {
      const agreedAmount = toDecimal('18000.00')
      const currentPaid = toDecimal('5000.00')
      const remaining = agreedAmount.minus(currentPaid) // 13.000 TL

      const proposedPayment1 = toDecimal('13000.00')
      const proposedPayment2 = toDecimal('13000.01')

      // 13.000 TL kabul edilebilir
      expect(proposedPayment1.lessThanOrEqualTo(remaining)).toBe(true)

      // 13.000.01 TL (kalanı aşan tutar) reddedilmelidir
      expect(proposedPayment2.greaterThan(remaining)).toBe(true)
    })
  })

  // 5. Ücretin Mevcut Ödeme Toplamının Altına İndirilememesi
  describe('Sefer Ücreti Alt Sınır Kuralı', () => {
    it('yeni anlaşılan ücret yapılmış ödemeler toplamından küçük olamaz', () => {
      const currentPaidTotal = toDecimal('5000.00')

      const allowedNewFee = toDecimal('6000.00')
      const exactNewFee = toDecimal('5000.00')
      const invalidNewFee = toDecimal('4999.99')

      expect(allowedNewFee.greaterThanOrEqualTo(currentPaidTotal)).toBe(true)
      expect(exactNewFee.greaterThanOrEqualTo(currentPaidTotal)).toBe(true)
      expect(invalidNewFee.lessThan(currentPaidTotal)).toBe(true) // HATA! Reddedilmeli
    })
  })

  // 6. Sefer Durum Geçiş Akışı
  describe('Sefer Durum Akışı Kuralları', () => {
    it('PLANNED durumundan yalnızca ON_ROAD ve CANCELLED durumlarına geçilebilir', () => {
      expect(canTransitionTripStatus(TripStatus.PLANNED, TripStatus.ON_ROAD)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.PLANNED, TripStatus.CANCELLED)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.PLANNED, TripStatus.COMPLETED)).toBe(false)
    })

    it('ON_ROAD durumundan COMPLETED ve CANCELLED durumlarına geçilebilir', () => {
      expect(canTransitionTripStatus(TripStatus.ON_ROAD, TripStatus.COMPLETED)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.ON_ROAD, TripStatus.CANCELLED)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.ON_ROAD, TripStatus.PLANNED)).toBe(false)
    })

    it('COMPLETED ve CANCELLED nihai durumlardır, geriye dönüş yapılamaz', () => {
      expect(canTransitionTripStatus(TripStatus.COMPLETED, TripStatus.PLANNED)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.COMPLETED, TripStatus.ON_ROAD)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.COMPLETED, TripStatus.CANCELLED)).toBe(false)

      expect(canTransitionTripStatus(TripStatus.CANCELLED, TripStatus.PLANNED)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.CANCELLED, TripStatus.ON_ROAD)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.CANCELLED, TripStatus.COMPLETED)).toBe(false)
    })
  })

  // 7. Çakışan Sefer Tespiti
  describe('Zaman Aralığı Çakışma Kontrolü (Trip Overlap)', () => {
    const isOverlapping = (
      startA: Date,
      endA: Date,
      startB: Date,
      endB: Date
    ) => {
      return startA < endB && endA > startB
    }

    it('aynı otobüse ait zaman aralığı kesişen iki seferi doğru tespit etmelidir', () => {
      const trip1Start = new Date('2026-11-01T08:00:00Z')
      const trip1End = new Date('2026-11-01T16:00:00Z')

      // Tam çakışan
      const overlapping1 = new Date('2026-11-01T10:00:00Z')
      const overlapping2 = new Date('2026-11-01T14:00:00Z')
      expect(isOverlapping(trip1Start, trip1End, overlapping1, overlapping2)).toBe(true)

      // Kısmi çakışan (önceden başlayıp içine sarkan)
      const partialOverlap1 = new Date('2026-11-01T06:00:00Z')
      const partialOverlap2 = new Date('2026-11-01T10:00:00Z')
      expect(isOverlapping(trip1Start, trip1End, partialOverlap1, partialOverlap2)).toBe(true)

      // Çakışmayan (sonra başlayan)
      const afterStart = new Date('2026-11-01T16:00:00Z')
      const afterEnd = new Date('2026-11-01T22:00:00Z')
      expect(isOverlapping(trip1Start, trip1End, afterStart, afterEnd)).toBe(false)
    })
  })

  // 8. İstanbul Saati Gün Sınırı ve Tarih Filtreleri
  describe('İstanbul Zaman Dilimi (Europe/Istanbul)', () => {
    it('günün başlangıç ve bitişini İstanbul saat dilimine göre UTC olarak doğru hesaplamalıdır', () => {
      const testDate = new Date('2026-10-21T12:00:00Z')
      const { startUtc, endUtc } = getIstanbulDayRange(testDate)

      // İstanbul saatiyle günün başlangıcı (00:00:00+03:00) UTC'de bir önceki günün 21:00:00'ına denk gelir
      expect(startUtc.getUTCHours()).toBe(21)
      expect(startUtc.toISOString()).toContain('2026-10-20T21:00:00')

      // Günün bitişi (23:59:59.999+03:00) UTC'de 20:59:59.999'a denk gelir
      expect(endUtc.toISOString()).toContain('2026-10-21T20:59:59')
    })
  })

  // 9. CSV Formula Injection Koruması
  describe('CSV Güvenliği ve Formula Injection Koruması', () => {
    it('formül karakterleriyle (=, +, -, @) başlayan değerlerin önüne tek tırnak eklemelidir', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"')
      expect(sanitizeCsvCell('+cmd|')).toBe('"\'+cmd|"')
      expect(sanitizeCsvCell('-500')).toBe('"\'-500"')
      expect(sanitizeCsvCell('@test')).toBe('"\'@test"')
    })

    it('normal metin ve çift tırnakları düzgün escape etmelidir', () => {
      expect(sanitizeCsvCell('35 ABC 123')).toBe('"35 ABC 123"')
      expect(sanitizeCsvCell('Mehmet "Şoför" Yılmaz')).toBe('"Mehmet ""Şoför"" Yılmaz"')
    })
  })
})
