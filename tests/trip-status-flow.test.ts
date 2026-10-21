import { describe, it, expect } from 'vitest'
import { TripStatus } from '@prisma/client'
import { canTransitionTripStatus } from '../server/utils/business'
import { z } from 'zod'

describe('Sefer Durum Akışı ve Güvenli Durum Geçişleri (STATE 06)', () => {
  describe('Durum Geçiş Kuralları (canTransitionTripStatus)', () => {
    it('PLANNED durumundan geçerli geçişler: ON_ROAD ve CANCELLED', () => {
      expect(canTransitionTripStatus(TripStatus.PLANNED, TripStatus.ON_ROAD)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.PLANNED, TripStatus.CANCELLED)).toBe(true)
    })

    it('PLANNED durumundan COMPLETED durumuna doğrudan geçilemez', () => {
      expect(canTransitionTripStatus(TripStatus.PLANNED, TripStatus.COMPLETED)).toBe(false)
    })

    it('ON_ROAD durumundan geçerli geçişler: COMPLETED ve CANCELLED', () => {
      expect(canTransitionTripStatus(TripStatus.ON_ROAD, TripStatus.COMPLETED)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.ON_ROAD, TripStatus.CANCELLED)).toBe(true)
    })

    it('ON_ROAD durumundan geriye PLANNED durumuna dönülemez', () => {
      expect(canTransitionTripStatus(TripStatus.ON_ROAD, TripStatus.PLANNED)).toBe(false)
    })

    it('COMPLETED son durumdur; hiçbir duruma geçiş yapılamaz', () => {
      expect(canTransitionTripStatus(TripStatus.COMPLETED, TripStatus.PLANNED)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.COMPLETED, TripStatus.ON_ROAD)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.COMPLETED, TripStatus.CANCELLED)).toBe(false)
    })

    it('CANCELLED son durumdur; hiçbir duruma geçiş yapılamaz', () => {
      expect(canTransitionTripStatus(TripStatus.CANCELLED, TripStatus.PLANNED)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.CANCELLED, TripStatus.ON_ROAD)).toBe(false)
      expect(canTransitionTripStatus(TripStatus.CANCELLED, TripStatus.COMPLETED)).toBe(false)
    })

    it('Aynı duruma geçiş idempotence olarak true döner', () => {
      expect(canTransitionTripStatus(TripStatus.PLANNED, TripStatus.PLANNED)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.ON_ROAD, TripStatus.ON_ROAD)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.COMPLETED, TripStatus.COMPLETED)).toBe(true)
      expect(canTransitionTripStatus(TripStatus.CANCELLED, TripStatus.CANCELLED)).toBe(true)
    })
  })

  describe('Ödemesi Olan Seferin İptal Edilmesini Engelleme Kuralı', () => {
    const validateCancellation = (targetStatus: TripStatus, paymentCount: number) => {
      if (targetStatus === TripStatus.CANCELLED && paymentCount > 0) {
        throw new Error(
          'Bu sefere ait ödeme kayıtları bulunmaktadır. Ödemesi olan bir sefer iptal edilemez. Önce seferin ödemelerini silmeli veya düzenlemelisiniz.'
        )
      }
      return true
    }

    it('Ödemesi olmayan sefer başarıyla iptal edilebilir', () => {
      expect(validateCancellation(TripStatus.CANCELLED, 0)).toBe(true)
    })

    it('Ödemesi olan (1 veya daha fazla) sefer iptal edilmek istendiğinde hata fırlatır', () => {
      expect(() => validateCancellation(TripStatus.CANCELLED, 1)).toThrow(
        'Ödemesi olan bir sefer iptal edilemez'
      )
      expect(() => validateCancellation(TripStatus.CANCELLED, 3)).toThrow(
        'Ödemesi olan bir sefer iptal edilemez'
      )
    })

    it('İptal dışındaki durum güncellemelerinde ödeme sayısı engel teşkil etmez', () => {
      expect(validateCancellation(TripStatus.ON_ROAD, 2)).toBe(true)
      expect(validateCancellation(TripStatus.COMPLETED, 2)).toBe(true)
    })
  })

  describe('Eski Duruma Dayalı Eşzamanlı İşlem Koruması (Stale State Protection)', () => {
    const validateCurrentStatus = (
      dbStatus: TripStatus,
      clientExpectedStatus?: TripStatus
    ) => {
      if (clientExpectedStatus && clientExpectedStatus !== dbStatus) {
        const err: any = new Error(
          `Sefer durumu başka bir kullanıcı tarafından güncellenmiştir (Güncel durum: "${dbStatus}"). Lütfen sayfayı yenileyin.`
        )
        err.statusCode = 409
        throw err
      }
      return true
    }

    it('İstemcinin bildiği durum DB ile aynıysa işlem onaylanır', () => {
      expect(validateCurrentStatus(TripStatus.PLANNED, TripStatus.PLANNED)).toBe(true)
      expect(validateCurrentStatus(TripStatus.ON_ROAD, TripStatus.ON_ROAD)).toBe(true)
    })

    it('İstemcinin bildiği durum DB ile uyuşmuyorsa 409 Conflict hatası üretilir', () => {
      expect(() =>
        validateCurrentStatus(TripStatus.ON_ROAD, TripStatus.PLANNED)
      ).toThrow('Sefer durumu başka bir kullanıcı tarafından güncellenmiştir')

      try {
        validateCurrentStatus(TripStatus.COMPLETED, TripStatus.ON_ROAD)
      } catch (err: any) {
        expect(err.statusCode).toBe(409)
      }
    })
  })

  describe('Sıralama Alanları Allowlist Doğrulaması', () => {
    const sortSchema = z.object({
      sortBy: z.enum(['startsAt', 'endsAt', 'agreedAmount', 'createdAt']).default('startsAt'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
    })

    it('Allowlist içindeki geçerli alanları kabul eder', () => {
      expect(sortSchema.parse({ sortBy: 'startsAt', sortOrder: 'asc' })).toEqual({
        sortBy: 'startsAt',
        sortOrder: 'asc',
      })
      expect(sortSchema.parse({ sortBy: 'agreedAmount', sortOrder: 'desc' })).toEqual({
        sortBy: 'agreedAmount',
        sortOrder: 'desc',
      })
      expect(sortSchema.parse({ sortBy: 'createdAt', sortOrder: 'desc' })).toEqual({
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
    })

    it('Allowlist dışındaki alanları reddeder (SQL/Prisma Injection koruması)', () => {
      expect(() => sortSchema.parse({ sortBy: 'password' })).toThrow()
      expect(() => sortSchema.parse({ sortBy: 'id; DROP TABLE' })).toThrow()
      expect(() => sortSchema.parse({ sortOrder: 'random' })).toThrow()
    })
  })
})
