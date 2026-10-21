import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials } from '../../utils/business'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Sefer ID belirtilmelidir.' })
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      bus: true,
      owner: true,
      convoy: true,
      payments: {
        orderBy: { paidAt: 'desc' },
      },
    },
  })

  if (!trip) {
    throw createError({ statusCode: 404, statusMessage: 'Sefer bulunamadı.' })
  }

  const fin = calculateTripFinancials(trip.agreedAmount, trip.payments)

  return {
    ...trip,
    agreedAmount: fin.agreedAmount,
    totalPaid: fin.totalPaid,
    remainingAmount: fin.remainingAmount,
    paymentStatus: fin.status,
  }
})
