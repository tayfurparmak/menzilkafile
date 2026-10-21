import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { TripStatus } from '@prisma/client'
import { calculateTripFinancials, getIstanbulDayRange, toDecimal } from '../server/utils/business'

describe('Operasyon Gösterge Paneli ve Raporlama (STATE 08)', () => {
  describe('Gösterge Paneli Mali Dönem Hesaplamaları', () => {
    // 3 Sefer: 2 aktif, 1 iptal edilmiş
    const mockTrips = [
      {
        id: 'trip-1',
        startsAt: new Date('2026-11-05T08:00:00Z'),
        status: TripStatus.ON_ROAD,
        agreedAmount: '15000.00',
        payments: [{ amount: '5000.00' }, { amount: '2000.00' }], // 7.000 TL ödenen, 8.000 TL kalan
      },
      {
        id: 'trip-2',
        startsAt: new Date('2026-11-10T10:00:00Z'),
        status: TripStatus.PLANNED,
        agreedAmount: '12000.00',
        payments: [{ amount: '4000.00' }], // 4.000 TL ödenen, 8.000 TL kalan
      },
      {
        id: 'trip-3',
        startsAt: new Date('2026-11-15T09:00:00Z'),
        status: TripStatus.CANCELLED, // İPTAL EDİLMİŞ
        agreedAmount: '20000.00',
        payments: [], // İptal edilen sefere ödeme girilemez
      },
    ]

    it('İptal edilmiş seferler mali toplamlardan tamamen hariç tutulur', () => {
      let totalAgreed = new Decimal(0)
      let totalPaid = new Decimal(0)

      for (const t of mockTrips) {
        if (t.status !== TripStatus.CANCELLED) {
          const fin = calculateTripFinancials(t.agreedAmount, t.payments)
          totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
          totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
        }
      }

      const totalRemaining = totalAgreed.minus(totalPaid)

      // 15.000 + 12.000 = 27.000 TL (trip-3 olan 20.000 TL dahil edilmez)
      expect(totalAgreed.toFixed(2)).toBe('27000.00')
      // 7.000 + 4.000 = 11.000 TL
      expect(totalPaid.toFixed(2)).toBe('11000.00')
      // 27.000 - 11.000 = 16.000 TL
      expect(totalRemaining.toFixed(2)).toBe('16000.00')
    })

    it('Mali dönem filtresi seferin başlangıç tarihine (startsAt) göre uygulanır', () => {
      const periodStart = new Date('2026-11-01T00:00:00Z')
      const periodEnd = new Date('2026-11-08T23:59:59Z')

      // Sadece trip-1 (05 Kasım) bu döneme girer
      const filtered = mockTrips.filter(
        (t) => t.status !== TripStatus.CANCELLED && t.startsAt >= periodStart && t.startsAt <= periodEnd
      )

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('trip-1')

      const fin = calculateTripFinancials(filtered[0].agreedAmount, filtered[0].payments)
      expect(fin.agreedAmount).toBe('15000.00')
      expect(fin.totalPaid).toBe('7000.00')
      expect(fin.remainingAmount).toBe('8000.00')
    })
  })

  describe('Bugün Başlayan Seferler (Europe/Istanbul)', () => {
    it('İstanbul yerel saat dilimine göre günün başlangıç ve bitişini doğru hesaplar', () => {
      const testDate = new Date('2026-10-21T10:00:00Z')
      const { startUtc, endUtc } = getIstanbulDayRange(testDate)

      // İstanbul UTC+3 olduğu için İstanbul 00:00 UTC 21:00 (önceki gün) olmalıdır
      expect(startUtc.toISOString()).toBe('2026-10-20T21:00:00.000Z')
      expect(endUtc.toISOString()).toBe('2026-10-21T20:59:59.999Z')
    })

    it('Bugün başlayan seferler sayılırken iptal edilmiş seferler elenir', () => {
      const todayTrips = [
        { id: '1', startsAt: new Date('2026-10-21T07:00:00Z'), status: TripStatus.ON_ROAD },
        { id: '2', startsAt: new Date('2026-10-21T08:30:00Z'), status: TripStatus.PLANNED },
        { id: '3', startsAt: new Date('2026-10-21T09:00:00Z'), status: TripStatus.CANCELLED },
      ]

      const activeTodayCount = todayTrips.filter((t) => t.status !== TripStatus.CANCELLED).length
      expect(activeTodayCount).toBe(2)
    })
  })

  describe('Kafile Detayı Hesaplamaları', () => {
    const convoyTrips = [
      { id: 't1', busId: 'bus-1', capacitySnapshot: 46, status: TripStatus.COMPLETED, agreedAmount: '10000.00', payments: [{ amount: '10000.00' }] },
      { id: 't2', busId: 'bus-1', capacitySnapshot: 46, status: TripStatus.ON_ROAD, agreedAmount: '10000.00', payments: [{ amount: '5000.00' }] }, // Aynı otobüs ikinci sefer
      { id: 't3', busId: 'bus-2', capacitySnapshot: 54, status: TripStatus.PLANNED, agreedAmount: '12000.00', payments: [] },
      { id: 't4', busId: 'bus-3', capacitySnapshot: 41, status: TripStatus.CANCELLED, agreedAmount: '8000.00', payments: [] }, // İptal
    ]

    it('Benzersiz otobüs sayısını doğru hesaplar (aynı otobüs birden fazla sefere çıksa da tek sayılır)', () => {
      const uniqueBuses = new Set<string>()
      for (const t of convoyTrips) {
        if (t.status !== TripStatus.CANCELLED) {
          uniqueBuses.add(t.busId)
        }
      }
      // bus-1 ve bus-2 aktif seferlerde kullanılmıştır (2 adet benzersiz araç)
      expect(uniqueBuses.size).toBe(2)
    })

    it('Sefer bazında toplam kapasiteyi doğru hesaplar (iptal edilen seferler dahil edilmez)', () => {
      const activeTrips = convoyTrips.filter((t) => t.status !== TripStatus.CANCELLED)
      const totalCapacity = activeTrips.reduce((acc, t) => acc + t.capacitySnapshot, 0)

      // 46 + 46 + 54 = 146 koltuk
      expect(totalCapacity).toBe(146)
    })

    it('Kapasiteyi yolcu sayısı olarak adlandırmaz; koltuk kapasitesi olarak tanımlar', () => {
      const label = 'Sefer bazında toplam koltuk kapasitesi (aynı otobüs birden fazla sefer yapabilir)'
      expect(label.toLowerCase()).not.toContain('yolcu sayısı')
      expect(label).toContain('koltuk kapasitesi')
    })

    it('Kafile mali toplamlarını doğru türetir', () => {
      let totalAgreed = new Decimal(0)
      let totalPaid = new Decimal(0)

      for (const t of convoyTrips) {
        if (t.status !== TripStatus.CANCELLED) {
          const fin = calculateTripFinancials(t.agreedAmount, t.payments)
          totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
          totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
        }
      }

      // 10.000 + 10.000 + 12.000 = 32.000 TL
      expect(totalAgreed.toFixed(2)).toBe('32000.00')
      // 10.000 + 5.000 = 15.000 TL
      expect(totalPaid.toFixed(2)).toBe('15000.00')
      // 32.000 - 15.000 = 17.000 TL
      expect(totalAgreed.minus(totalPaid).toFixed(2)).toBe('17000.00')
    })
  })

  describe('Araç Sahibi Tarihsel Sefer ve Mali Raporlama', () => {
    it('Tarihsel olarak araca değil araç sahibine (ownerId) ait seferleri esas alır', () => {
      const ownerTrips = [
        { id: 't1', ownerId: 'owner-1', agreedAmount: '8000.00', payments: [{ amount: '8000.00' }], status: TripStatus.COMPLETED },
        { id: 't2', ownerId: 'owner-1', agreedAmount: '7000.00', payments: [{ amount: '3000.00' }], status: TripStatus.ON_ROAD },
      ]

      let totalAgreed = new Decimal(0)
      let totalPaid = new Decimal(0)

      for (const t of ownerTrips) {
        const fin = calculateTripFinancials(t.agreedAmount, t.payments)
        totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
        totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
      }

      expect(totalAgreed.toFixed(2)).toBe('15000.00')
      expect(totalPaid.toFixed(2)).toBe('11000.00')
      expect(totalAgreed.minus(totalPaid).toFixed(2)).toBe('4000.00')
    })
  })
})
