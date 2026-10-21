import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials, toDecimal } from '../../utils/business'
import Decimal from 'decimal.js'

import { z } from 'zod'

const ownerQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Araç sahibi ID belirtilmelidir.' })
  }

  const query = await getValidatedQuery(event, (data) => ownerQuerySchema.parse(data))

  const tripWhere: any = {
    ownerId: id,
  }

  if (query.startDate || query.endDate) {
    tripWhere.startsAt = {}
    if (query.startDate) {
      tripWhere.startsAt.gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const endD = new Date(query.endDate)
      if (query.endDate.length === 10) endD.setHours(23, 59, 59, 999)
      tripWhere.startsAt.lte = endD
    }
  }

  // N+1 sorgularını önlemek için araç sahibi, güncel otobüsleri ve seferleri tek seferde çekilir
  const [owner, periodTrips] = await Promise.all([
    prisma.vehicleOwner.findUnique({
      where: { id },
      include: {
        buses: {
          orderBy: { plate: 'asc' },
        },
      },
    }),
    prisma.trip.findMany({
      where: tripWhere,
      orderBy: { startsAt: 'desc' },
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
        },
        convoy: {
          select: { id: true, name: true },
        },
      },
    }),
  ])

  if (!owner) {
    throw createError({ statusCode: 404, statusMessage: 'Araç sahibi bulunamadı.' })
  }

  let totalAgreed = new Decimal(0)
  let totalPaid = new Decimal(0)

  const tripsWithFinancials = periodTrips.map((trip) => {
    const fin = calculateTripFinancials(trip.agreedAmount, trip.payments)
    if (trip.status !== 'CANCELLED') {
      totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
      totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
    }
    return {
      ...trip,
      agreedAmount: fin.agreedAmount,
      totalPaid: fin.totalPaid,
      remainingAmount: fin.remainingAmount,
      paymentStatus: fin.status,
    }
  })

  const totalRemaining = totalAgreed.minus(totalPaid)

  return {
    ...owner,
    trips: tripsWithFinancials,
    financialSummary: {
      totalAgreedAmount: totalAgreed.toFixed(2),
      totalPaidAmount: totalPaid.toFixed(2),
      totalRemainingAmount: totalRemaining.toFixed(2),
      periodExplanation:
        'Mali toplamlar; sefer başlangıç tarihi seçilen dönemde olan iptal edilmemiş seferleri ve yalnızca bu seferlere bağlı ödemeleri kapsar.',
    },
  }
})
