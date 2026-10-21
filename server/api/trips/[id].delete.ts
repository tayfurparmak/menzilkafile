import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Sefer ID belirtilmelidir.' })
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      payments: true,
    },
  })

  if (!trip) {
    throw createError({ statusCode: 404, statusMessage: 'Sefer bulunamadı.' })
  }

  await prisma.$transaction(async (tx) => {
    // Varsa ilişkili ödemeleri sil
    if (trip.payments.length > 0) {
      await tx.payment.deleteMany({
        where: { tripId: id },
      })
    }

    // Sefer kaydını sil
    await tx.trip.delete({
      where: { id },
    })
  })

  return {
    success: true,
    message: 'Sefer ve ilişkili kayıtlar başarıyla silindi.',
  }
})
