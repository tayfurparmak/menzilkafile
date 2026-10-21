import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials } from '../../utils/business'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Otobüs ID belirtilmelidir.' })
  }

  const bus = await prisma.bus.findUnique({
    where: { id },
    include: {
      owner: true,
      trips: {
        orderBy: { startsAt: 'desc' },
        include: {
          convoy: { select: { id: true, name: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  })

  if (!bus) {
    throw createError({ statusCode: 404, statusMessage: 'Otobüs bulunamadı.' })
  }

  const tripsWithFinancials = bus.trips.map((trip) => {
    const fin = calculateTripFinancials(trip.agreedAmount, trip.payments)
    return {
      ...trip,
      agreedAmount: fin.agreedAmount,
      totalPaid: fin.totalPaid,
      remainingAmount: fin.remainingAmount,
      paymentStatus: fin.status,
    }
  })

  return {
    ...bus,
    trips: tripsWithFinancials,
  }
})
