import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuthUser } from '../../../utils/auth'
import { canTransitionTripStatus, calculateTripFinancials } from '../../../utils/business'
import { TripStatus } from '@prisma/client'

const statusSchema = z.object({
  status: z.nativeEnum(TripStatus),
  currentStatus: z.nativeEnum(TripStatus).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Sefer ID belirtilmelidir.' })
  }

  const body = await readValidatedBody(event, (data) => statusSchema.parse(data))

  const updated = await prisma.$transaction(async (tx) => {
    // Eşzamanlı yarış durumlarını önlemek için sefer kaydını FOR UPDATE ile kilitler
    const rows: any = await tx.$queryRawUnsafe(
      `SELECT id, status FROM "Trip" WHERE id = $1 FOR UPDATE;`,
      id
    )

    if (!rows || rows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Sefer bulunamadı.' })
    }

    const currentDbStatus: TripStatus = rows[0].status

    // Eski duruma dayalı geçersiz eşzamanlı işlemi engelle
    if (body.currentStatus && body.currentStatus !== currentDbStatus) {
      throw createError({
        statusCode: 409,
        statusMessage: `Sefer durumu başka bir kullanıcı tarafından güncellenmiştir (Güncel durum: "${currentDbStatus}"). Lütfen sayfayı yenileyin.`,
      })
    }

    if (!canTransitionTripStatus(currentDbStatus, body.status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Geçersiz durum geçişi: "${currentDbStatus}" durumundan "${body.status}" durumuna geçilemez.`,
      })
    }

    // İş kuralı: Ödemesi bulunan seferin iptali engellenir
    if (body.status === TripStatus.CANCELLED) {
      const paymentCount = await tx.payment.count({ where: { tripId: id } })
      if (paymentCount > 0) {
        throw createError({
          statusCode: 400,
          statusMessage:
            'Bu sefere ait ödeme kayıtları bulunmaktadır. Ödemesi olan bir sefer iptal edilemez. Önce seferin ödemelerini silmeli veya düzenlemelisiniz.',
        })
      }
    }

    return await tx.trip.update({
      where: { id },
      data: { status: body.status },
      include: { payments: true },
    })
  })

  const fin = calculateTripFinancials(updated.agreedAmount, updated.payments)

  return {
    success: true,
    data: {
      ...updated,
      agreedAmount: fin.agreedAmount,
      totalPaid: fin.totalPaid,
      remainingAmount: fin.remainingAmount,
      paymentStatus: fin.status,
    },
  }
})
