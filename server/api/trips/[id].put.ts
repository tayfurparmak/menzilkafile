import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials, canTransitionTripStatus, toDecimal } from '../../utils/business'
import { TripStatus } from '@prisma/client'
import Decimal from 'decimal.js'

const updateTripSchema = z.object({
  busId: z.string().optional(),
  convoyId: z.string().optional().nullable(),
  departureLocation: z.string().trim().min(2).optional(),
  arrivalLocation: z.string().trim().min(2).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.nativeEnum(TripStatus).optional(),
  agreedAmount: z.union([z.string(), z.number()]).optional(),
  notes: z.string().trim().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Sefer ID belirtilmelidir.' })
  }

  const existingTrip = await prisma.trip.findUnique({
    where: { id },
    include: {
      payments: true,
      bus: { include: { owner: true } },
    },
  })

  if (!existingTrip) {
    throw createError({ statusCode: 404, statusMessage: 'Sefer bulunamadı.' })
  }

  const body = await readValidatedBody(event, (data) => updateTripSchema.parse(data))

  // 1. Durum Geçişi Kontrolü
  if (body.status && body.status !== existingTrip.status) {
    if (!canTransitionTripStatus(existingTrip.status, body.status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Geçersiz durum geçişi: "${existingTrip.status}" durumundan "${body.status}" durumuna geçilemez.`,
      })
    }

    // Ödemesi bulunan seferin iptalini ilk sürümde engelle
    if (body.status === TripStatus.CANCELLED && existingTrip.payments.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Bu sefere ait ödeme kayıtları bulunmaktadır. Ödemesi olan bir sefer iptal edilemez. Lütfen önce ödemeleri silin veya düzenleyin.',
      })
    }
  }

  // 2. Sefer başladıktan sonra otobüs ve tarihsel araç sahibi değiştirilememeli
  const isTripStarted = existingTrip.status === TripStatus.ON_ROAD || existingTrip.status === TripStatus.COMPLETED
  if (body.busId && body.busId !== existingTrip.busId && isTripStarted) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Yoldaki veya tamamlanmış bir seferin otobüsü ve tarihsel araç sahibi değiştirilemez.',
    })
  }

  // 3. Ücret kontrolü: Sefer ücreti, mevcut ödemeler toplamının altına düşürülememeli
  let newAgreedAmountDecimal = toDecimal(existingTrip.agreedAmount)
  if (body.agreedAmount !== undefined) {
    newAgreedAmountDecimal = toDecimal(body.agreedAmount)
    if (newAgreedAmountDecimal.lessThan(0)) {
      throw createError({ statusCode: 400, statusMessage: 'Anlaşılan ücret 0 veya daha büyük olmalıdır.' })
    }
    const currentFinancials = calculateTripFinancials(existingTrip.agreedAmount, existingTrip.payments)
    const totalPaidDecimal = toDecimal(currentFinancials.totalPaid)

    if (newAgreedAmountDecimal.lessThan(totalPaidDecimal)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Sefer ücreti, mevcut yapılmış ödemeler toplamından (${currentFinancials.totalPaid} TL) daha düşük bir tutara indirilemez.`,
      })
    }
  }

  const newStartsAt = body.startsAt ? new Date(body.startsAt) : existingTrip.startsAt
  const newEndsAt = body.endsAt ? new Date(body.endsAt) : existingTrip.endsAt
  const targetBusId = body.busId || existingTrip.busId

  if (newEndsAt <= newStartsAt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Sefer bitiş tarihi, başlangıç tarihinden sonra olmalıdır.',
    })
  }

  // 4. Eşzamanlı Finansal ve Çakışma Kontrolü (Transaction altında)
  const updatedTrip = await prisma.$transaction(async (tx) => {
    // Eşzamanlı ödeme ve sefer güncellemelerini sıraya sokmak için Sefer kaydını kilitler
    await tx.$queryRawUnsafe(`SELECT id FROM "Trip" WHERE id = $1 FOR UPDATE;`, id)

    // Eşzamanlı isteklerde çakışmayı önlemek için hedef otobüs kaydı üzerinde FOR UPDATE satır kilidi uygulanır
    await tx.$queryRawUnsafe(`SELECT id FROM "Bus" WHERE id = $1 FOR UPDATE;`, targetBusId)

    // Ücret düşürme kontrolünü kilitli satır ve güncel ödemelerle doğrula
    if (body.agreedAmount !== undefined) {
      const currentPayments = await tx.payment.findMany({ where: { tripId: id } })
      const totalPaidDecimal = currentPayments.reduce(
        (acc, p) => acc.plus(toDecimal(p.amount)),
        new Decimal(0)
      )
      if (newAgreedAmountDecimal.lessThan(totalPaidDecimal)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Sefer ücreti, mevcut yapılmış ödemeler toplamından (${totalPaidDecimal.toFixed(2)} TL) daha düşük bir tutara indirilemez.`,
        })
      }
    }

    // Hedef otobüs değiştiyse yeni otobüs bilgilerini al
    let snapshotUpdate = {}
    if (body.busId && body.busId !== existingTrip.busId) {
      const newBus = await tx.bus.findUnique({
        where: { id: body.busId },
        include: { owner: true },
      })
      if (!newBus) throw createError({ statusCode: 404, statusMessage: 'Yeni seçilen otobüs bulunamadı.' })
      if (!newBus.isActive) throw createError({ statusCode: 400, statusMessage: 'Pasif durumdaki otobüs atanamaz.' })
      if (!newBus.owner.isActive) throw createError({ statusCode: 400, statusMessage: 'Araç sahibi pasif olan otobüs atanamaz.' })

      snapshotUpdate = {
        busId: newBus.id,
        ownerId: newBus.ownerId,
        plateSnapshot: newBus.plate,
        capacitySnapshot: newBus.capacity,
        ownerNameSnapshot: newBus.owner.name,
      }
    }

    // Eğer sefer CANCELLED yapılmıyorsa ve tarih/otobüs değiştiyse çakışma kontrolü yap
    const willBeCancelled = (body.status || existingTrip.status) === TripStatus.CANCELLED
    if (!willBeCancelled) {
      const overlapping = await tx.trip.findFirst({
        where: {
          id: { not: existingTrip.id },
          busId: targetBusId,
          status: { not: TripStatus.CANCELLED },
          startsAt: { lt: newEndsAt },
          endsAt: { gt: newStartsAt },
        },
      })
      if (overlapping) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Seçilen otobüsün belirtilen tarih aralığında çakışan başka bir aktif seferi mevcuttur.',
        })
      }
    }

    return await tx.trip.update({
      where: { id },
      data: {
        ...snapshotUpdate,
        ...(body.convoyId !== undefined ? { convoyId: body.convoyId } : {}),
        ...(body.departureLocation !== undefined ? { departureLocation: body.departureLocation } : {}),
        ...(body.arrivalLocation !== undefined ? { arrivalLocation: body.arrivalLocation } : {}),
        ...(body.startsAt !== undefined ? { startsAt: newStartsAt } : {}),
        ...(body.endsAt !== undefined ? { endsAt: newEndsAt } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.agreedAmount !== undefined ? { agreedAmount: newAgreedAmountDecimal.toFixed(2) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include: {
        bus: true,
        owner: true,
        convoy: true,
        payments: true,
      },
    })
  })

  const fin = calculateTripFinancials(updatedTrip.agreedAmount, updatedTrip.payments)

  return {
    success: true,
    data: {
      ...updatedTrip,
      agreedAmount: fin.agreedAmount,
      totalPaid: fin.totalPaid,
      remainingAmount: fin.remainingAmount,
      paymentStatus: fin.status,
    },
  }
})
