import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials, toDecimal } from '../../utils/business'
import Decimal from 'decimal.js'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Kafile ID belirtilmelidir.' })
  }

  const convoy = await prisma.convoy.findUnique({
    where: { id },
    include: {
      trips: {
        orderBy: { startsAt: 'desc' },
        include: {
          bus: { select: { id: true, plate: true, capacity: true } },
          payments: { select: { amount: true, paidAt: true, method: true } },
        },
      },
    },
  })

  if (!convoy) {
    throw createError({ statusCode: 404, statusMessage: 'Kafile bulunamadı.' })
  }

  let totalAgreed = new Decimal(0)
  let totalPaid = new Decimal(0)
  const uniqueBuses = new Set<string>()

  const tripsWithFinancials = convoy.trips.map((trip) => {
    const fin = calculateTripFinancials(trip.agreedAmount, trip.payments)
    if (trip.status !== 'CANCELLED') {
      totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
      totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
      uniqueBuses.add(trip.busId)
    }
    return {
      ...trip,
      agreedAmount: fin.agreedAmount,
      totalPaid: fin.totalPaid,
      remainingAmount: fin.remainingAmount,
      paymentStatus: fin.status,
    }
  })

  const nonCancelledTrips = convoy.trips.filter((t) => t.status !== 'CANCELLED')
  const totalCapacity = nonCancelledTrips.reduce((acc, t) => acc + t.capacitySnapshot, 0)
  const totalRemaining = totalAgreed.minus(totalPaid)

  return {
    ...convoy,
    trips: tripsWithFinancials,
    summary: {
      busCount: uniqueBuses.size,
      tripCount: nonCancelledTrips.length,
      totalCapacity,
      capacityLabel: 'Sefer bazında toplam koltuk kapasitesi (aynı otobüs birden fazla sefer yapabilir)',
      totalAgreedAmount: totalAgreed.toFixed(2),
      totalPaidAmount: totalPaid.toFixed(2),
      totalRemainingAmount: totalRemaining.toFixed(2),
    },
  }
})
