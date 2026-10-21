import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { toDecimal } from '../../utils/business'
import { TripStatus } from '@prisma/client'

const createTripSchema = z
  .object({
    busId: z.string().min(1, 'Otobüs seçilmelidir.'),
    convoyId: z.string().optional().nullable(),
    departureLocation: z.string().trim().min(2, 'Kalkış yeri en az 2 karakter olmalıdır.'),
    arrivalLocation: z.string().trim().min(2, 'Varış yeri en az 2 karakter olmalıdır.'),
    startsAt: z.string().datetime({ message: 'Geçersiz başlangıç tarihi.' }),
    endsAt: z.string().datetime({ message: 'Geçersiz bitiş tarihi.' }),
    agreedAmount: z.union([z.string(), z.number()]).refine(
      (val) => {
        try {
          const d = toDecimal(val)
          return d.greaterThanOrEqualTo(0)
        } catch {
          return false
        }
      },
      { message: 'Anlaşılan sefer ücreti 0 veya daha büyük bir sayı olmalıdır.' }
    ),
    notes: z.string().trim().optional().nullable(),
    driverName: z.string().trim().optional().nullable(),
    driverPhone: z.string().trim().optional().nullable(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'Sefer bitiş tarihi, başlangıç tarihinden sonra olmalıdır.',
    path: ['endsAt'],
  })

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const body = await readValidatedBody(event, (data) => createTripSchema.parse(data))

  const startsAtDate = new Date(body.startsAt)
  const endsAtDate = new Date(body.endsAt)
  const agreedAmountDecimal = toDecimal(body.agreedAmount)

  // 1. Otobüs ve Araç Sahibi Aktiflik Kontrolleri
  const bus = await prisma.bus.findUnique({
    where: { id: body.busId },
    include: { owner: true },
  })

  if (!bus) {
    throw createError({ statusCode: 404, statusMessage: 'Seçilen otobüs bulunamadı.' })
  }
  if (!bus.isActive) {
    throw createError({ statusCode: 400, statusMessage: 'Pasif durumdaki otobüse yeni sefer atanamaz.' })
  }
  if (!bus.owner.isActive) {
    throw createError({ statusCode: 400, statusMessage: 'Araç sahibi pasif olan otobüse yeni sefer atanamaz.' })
  }

  // 2. Kafile kontrolü
  if (body.convoyId) {
    const convoy = await prisma.convoy.findUnique({ where: { id: body.convoyId } })
    if (!convoy) {
      throw createError({ statusCode: 404, statusMessage: 'Seçilen kafile bulunamadı.' })
    }
  }

  // 3. Eşzamanlı çakışma kontrolü ve Snapshot Kaydı (Transaction altında)
  const createdTrip = await prisma.$transaction(async (tx) => {
    // Eşzamanlı isteklerde çakışmayı önlemek için ilgili otobüs kaydı üzerinde FOR UPDATE satır kilidi uygulanır
    await tx.$queryRawUnsafe(`SELECT id FROM "Bus" WHERE id = $1 FOR UPDATE;`, bus.id)

    // Aynı otobüse zaman aralığı çakışan, iptal edilmemiş iki sefer atanmasını engelle
    // Çakışma kuralı [başlangıç, bitiş): (startsAt < endsAtDate && endsAt > startsAtDate)
    const overlappingTrips = await tx.trip.findMany({
      where: {
        busId: bus.id,
        status: { not: TripStatus.CANCELLED },
        startsAt: { lt: endsAtDate },
        endsAt: { gt: startsAtDate },
      },
    })

    if (overlappingTrips.length > 0 && overlappingTrips[0]) {
      const conflict = overlappingTrips[0]
      const conflictStart = conflict.startsAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
      const conflictEnd = conflict.endsAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
      throw createError({
        statusCode: 409,
        statusMessage: `Seçilen "${bus.plate}" plakalı otobüsün bu saat aralığında (${conflictStart} - ${conflictEnd}) çakışan aktif bir seferi mevcuttur.`,
      })
    }

    return await tx.trip.create({
      data: {
        busId: bus.id,
        convoyId: body.convoyId || null,
        ownerId: bus.ownerId, // Tarihsel sahip referansı
        plateSnapshot: bus.plate, // Snapshot
        capacitySnapshot: bus.capacity, // Snapshot
        ownerNameSnapshot: bus.owner.name, // Snapshot
        driverName: body.driverName || bus.driverName || null,
        driverPhone: body.driverPhone || bus.driverPhone || null,
        departureLocation: body.departureLocation,
        arrivalLocation: body.arrivalLocation,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        status: TripStatus.PLANNED,
        agreedAmount: agreedAmountDecimal.toFixed(2),
        notes: body.notes || null,
      },
      include: {
        bus: true,
        owner: true,
        convoy: true,
      },
    })
  })

  return {
    success: true,
    data: createdTrip,
  }
})
