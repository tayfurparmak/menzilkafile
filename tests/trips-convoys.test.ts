import { describe, it, expect } from 'vitest'
import { TripStatus } from '@prisma/client'
import { parseIstanbulDateInput } from '../server/utils/business'

describe('Sefer ve Kafile Yönetimi İş Kuralları (STATE 05)', () => {
  describe('Zaman Aralığı Çakışma Kontrolü [başlangıç, bitiş)', () => {
    // Çakışma mantığı: (startsAt < existing.endsAt && endsAt > existing.startsAt)
    const isOverlapping = (
      existing: { startsAt: Date; endsAt: Date; status: TripStatus },
      candidate: { startsAt: Date; endsAt: Date }
    ) => {
      if (existing.status === TripStatus.CANCELLED) return false
      return candidate.startsAt < existing.endsAt && candidate.endsAt > existing.startsAt
    }

    const baseTrip = {
      startsAt: new Date('2026-11-01T10:00:00Z'),
      endsAt: new Date('2026-11-01T14:00:00Z'),
      status: TripStatus.PLANNED,
    }

    it('tam bitiş anında başlayan sefer çakışmaz [14:00 - 18:00)', () => {
      const adjacentNext = {
        startsAt: new Date('2026-11-01T14:00:00Z'),
        endsAt: new Date('2026-11-01T18:00:00Z'),
      }
      expect(isOverlapping(baseTrip, adjacentNext)).toBe(false)
    })

    it('tam başlangıç anında biten sefer çakışmaz [06:00 - 10:00)', () => {
      const adjacentPrev = {
        startsAt: new Date('2026-11-01T06:00:00Z'),
        endsAt: new Date('2026-11-01T10:00:00Z'),
      }
      expect(isOverlapping(baseTrip, adjacentPrev)).toBe(false)
    })

    it('kısmen çakışan seferleri tespit eder ve çakışma üretir [12:00 - 16:00)', () => {
      const partialOverlap = {
        startsAt: new Date('2026-11-01T12:00:00Z'),
        endsAt: new Date('2026-11-01T16:00:00Z'),
      }
      expect(isOverlapping(baseTrip, partialOverlap)).toBe(true)
    })

    it('mevcut seferin içinde kalan seferi tespit eder [11:00 - 13:00)', () => {
      const innerOverlap = {
        startsAt: new Date('2026-11-01T11:00:00Z'),
        endsAt: new Date('2026-11-01T13:00:00Z'),
      }
      expect(isOverlapping(baseTrip, innerOverlap)).toBe(true)
    })

    it('mevcut seferi tamamen kapsayan seferi tespit eder [09:00 - 15:00)', () => {
      const outerOverlap = {
        startsAt: new Date('2026-11-01T09:00:00Z'),
        endsAt: new Date('2026-11-01T15:00:00Z'),
      }
      expect(isOverlapping(baseTrip, outerOverlap)).toBe(true)
    })

    it('iptal edilmiş (CANCELLED) seferler çakışma kontrolüne takılmaz', () => {
      const cancelledTrip = {
        ...baseTrip,
        status: TripStatus.CANCELLED,
      }
      const overlappingTime = {
        startsAt: new Date('2026-11-01T11:00:00Z'),
        endsAt: new Date('2026-11-01T13:00:00Z'),
      }
      expect(isOverlapping(cancelledTrip, overlappingTime)).toBe(false)
    })
  })

  describe('Tarihsel Snapshot ve Otobüs Değişimi Kuralları', () => {
    it('Sefer oluşturulurken snapshot alanları otobüsten üretilir', () => {
      const bus = {
        id: 'bus-1',
        plate: '35 ABC 46',
        capacity: 46,
        ownerId: 'owner-1',
        owner: { name: 'Ahmet Taş' },
      }

      const createSnapshot = (b: typeof bus) => ({
        busId: b.id,
        ownerId: b.ownerId,
        plateSnapshot: b.plate,
        capacitySnapshot: b.capacity,
        ownerNameSnapshot: b.owner.name,
      })

      const snapshot = createSnapshot(bus)
      expect(snapshot.ownerId).toBe('owner-1')
      expect(snapshot.plateSnapshot).toBe('35 ABC 46')
      expect(snapshot.capacitySnapshot).toBe(46)
      expect(snapshot.ownerNameSnapshot).toBe('Ahmet Taş')
    })

    it('Sefer başladıktan sonra (ON_ROAD veya COMPLETED) otobüs değiştirilemez', () => {
      const canChangeBus = (status: TripStatus, newBusId: string, currentBusId: string) => {
        if (newBusId !== currentBusId) {
          if (status === TripStatus.ON_ROAD || status === TripStatus.COMPLETED) {
            throw new Error('Yoldaki veya tamamlanmış bir seferin otobüsü ve tarihsel araç sahibi değiştirilemez.')
          }
        }
        return true
      }

      expect(() => canChangeBus(TripStatus.ON_ROAD, 'bus-2', 'bus-1')).toThrow('değiştirilemez')
      expect(() => canChangeBus(TripStatus.COMPLETED, 'bus-2', 'bus-1')).toThrow('değiştirilemez')
      expect(canChangeBus(TripStatus.PLANNED, 'bus-2', 'bus-1')).toBe(true)
    })

    it('Planlanmış seferde otobüs değiştiğinde yeni otobüsün snapshot değerleri atanır', () => {
      const newBus = {
        id: 'bus-2',
        plate: '34 XYZ 54',
        capacity: 54,
        ownerId: 'owner-2',
        owner: { name: 'Mehmet Demir' },
      }

      const updateSnapshot = (newB: typeof newBus) => ({
        busId: newB.id,
        ownerId: newB.ownerId,
        plateSnapshot: newB.plate,
        capacitySnapshot: newB.capacity,
        ownerNameSnapshot: newB.owner.name,
      })

      const updated = updateSnapshot(newBus)
      expect(updated.plateSnapshot).toBe('34 XYZ 54')
      expect(updated.capacitySnapshot).toBe(54)
      expect(updated.ownerNameSnapshot).toBe('Mehmet Demir')
    })
  })

  describe('Europe/Istanbul Tarih Dönüşümü', () => {
    it('Yerel form saatini (YYYY-MM-DDTHH:mm) Europe/Istanbul (+03:00) olarak UTC nesnesine çevirir', () => {
      const inputStr = '2026-11-01T10:00'
      const utcDate = parseIstanbulDateInput(inputStr)

      // İstanbul 10:00, UTC 07:00 olmalıdır (10 - 3 = 7)
      expect(utcDate.toISOString()).toBe('2026-11-01T07:00:00.000Z')
    })

    it('Zaman dilimi içeren veya ISO string olan girdileri doğrudan kabul eder', () => {
      const isoStr = '2026-11-01T07:00:00.000Z'
      const date = parseIstanbulDateInput(isoStr)
      expect(date.toISOString()).toBe(isoStr)
    })
  })
})
