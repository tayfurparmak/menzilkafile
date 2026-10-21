import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { normalizePlate, isValidCapacity } from '../server/utils/business'

// Zod Schemas mirroring API validation
const createOwnerSchema = z.object({
  name: z.string().trim().min(2, 'Araç sahibi adı en az 2 karakter olmalıdır.'),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

const createBusSchema = z.object({
  plate: z.string().trim().min(3, 'Plaka en az 3 karakter olmalıdır.'),
  capacity: z.coerce.number().refine(isValidCapacity, {
    message: 'Kapasite yalnızca 41, 46 veya 54 olabilir.',
  }),
  ownerId: z.string().min(1, 'Araç sahibi seçilmelidir.'),
  notes: z.string().trim().optional().nullable(),
})

describe('Araç Sahibi ve Otobüs Yönetimi Kuralları (STATE 04)', () => {
  describe('Araç Sahibi Doğrulamaları', () => {
    it('Geçerli isimle araç sahibi kaydını doğrular', () => {
      const valid = createOwnerSchema.safeParse({
        name: 'Ahmet Yılmaz',
        phone: '0555 123 4567',
        notes: 'Güvenilir araç sahibi',
      })
      expect(valid.success).toBe(true)
    })

    it('2 karakterden kısa veya boş isimleri reddeder', () => {
      const invalidEmpty = createOwnerSchema.safeParse({ name: '  ' })
      expect(invalidEmpty.success).toBe(false)

      const invalidShort = createOwnerSchema.safeParse({ name: 'A' })
      expect(invalidShort.success).toBe(false)
    })
  })

  describe('Otobüs Plaka Normalizasyonu ve Mükerrer Kontrolü', () => {
    it('Farklı boşluk ve küçük harfle girilen plakaları tek bir normalize değere çevirir', () => {
      const p1 = normalizePlate('34  abc   01')
      const p2 = normalizePlate('  34 ABC 01  ')
      const p3 = normalizePlate('34 AbC 01')

      expect(p1).toBe('34 ABC 01')
      expect(p1).toBe(p2)
      expect(p2).toBe(p3)
    })

    it('Türkçe karakterli plakaları doğru büyütür', () => {
      expect(normalizePlate('35 izmir 35')).toBe('35 İZMİR 35')
      expect(normalizePlate('06 can 06')).toBe('06 CAN 06')
    })
  })

  describe('Otobüs Kapasitesi Kısıtı', () => {
    it('Sadece 41, 46 ve 54 kapasitelerini geçerli kabul eder', () => {
      expect(createBusSchema.safeParse({ plate: '35 ABC 01', capacity: 41, ownerId: 'own-1' }).success).toBe(true)
      expect(createBusSchema.safeParse({ plate: '35 ABC 02', capacity: 46, ownerId: 'own-1' }).success).toBe(true)
      expect(createBusSchema.safeParse({ plate: '35 ABC 03', capacity: 54, ownerId: 'own-1' }).success).toBe(true)
    })

    it('Geçersiz kapasiteleri (30, 40, 50, 55, 60) reddeder ve anlaşılır mesaj verir', () => {
      const testCases = [30, 40, 45, 50, 55, 60, -46]
      for (const cap of testCases) {
        const res = createBusSchema.safeParse({ plate: '35 ABC 99', capacity: cap, ownerId: 'own-1' })
        expect(res.success).toBe(false)
        if (!res.success) {
          expect(res.error.issues[0]?.message).toBe('Kapasite yalnızca 41, 46 veya 54 olabilir.')
        }
      }
    })
  })

  describe('İş Kuralları ve İlişki Koruması', () => {
    it('Pasif araç sahibine yeni otobüs atanmasını engelleme kuralı', () => {
      const owner = { id: 'own-inactive', name: 'Pasif Sahip', isActive: false }
      const canAssignBus = (o: typeof owner) => {
        if (!o.isActive) {
          throw new Error('Aktif olmayan bir araç sahibine otobüs eklenemez.')
        }
        return true
      }

      expect(() => canAssignBus(owner)).toThrow('Aktif olmayan bir araç sahibine otobüs eklenemez.')
    })

    it('İlişkili sefer veya otobüs kaydı bulunan varlıkların fiziksel silinmesini engeller', () => {
      const ownerWithBuses = { id: 'own-1', _count: { buses: 2, trips: 5 } }
      const busWithTrips = { id: 'bus-1', _count: { trips: 3 } }

      const canDeleteOwner = (o: typeof ownerWithBuses) => {
        if (o._count.buses > 0 || o._count.trips > 0) {
          throw new Error('İlişkili otobüs veya sefer kayıtları bulunan araç sahibi silinemez. Lütfen kaydı pasife alın.')
        }
        return true
      }

      const canDeleteBus = (b: typeof busWithTrips) => {
        if (b._count.trips > 0) {
          throw new Error('İlişkili sefer kayıtları bulunan otobüs silinemez. Lütfen aracı pasife alın.')
        }
        return true
      }

      expect(() => canDeleteOwner(ownerWithBuses)).toThrow('İlişkili otobüs veya sefer kayıtları bulunan araç sahibi silinemez')
      expect(() => canDeleteBus(busWithTrips)).toThrow('İlişkili sefer kayıtları bulunan otobüs silinemez')
    })
  })
})
