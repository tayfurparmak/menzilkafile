import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials, toDecimal } from '../../utils/business'
import Decimal from 'decimal.js'

const querySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const query = await getValidatedQuery(event, (data) => querySchema.parse(data))
  const { search, status, page, limit } = query
  const skip = (page - 1) * limit

  const where: any = {}

  if (status === 'active') where.isActive = true
  if (status === 'inactive') where.isActive = false

  if (search && search.trim() !== '') {
    where.name = { contains: search.trim(), mode: 'insensitive' }
  }

  const [total, convoys] = await Promise.all([
    prisma.convoy.count({ where }),
    prisma.convoy.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        trips: {
          include: {
            payments: { select: { amount: true } },
          },
        },
      },
    }),
  ])

  const items = convoys.map((c) => {
    const nonCancelledTrips = c.trips.filter((t) => t.status !== 'CANCELLED')
    
    // Kafileye atanan benzersiz otobüs sayısı
    const uniqueBusIds = new Set(nonCancelledTrips.map((t) => t.busId))
    
    // Toplam kapasite (Sefer bazlı toplam koltuk kapasitesi)
    const totalSeferKapasite = nonCancelledTrips.reduce((acc, t) => acc + t.capacitySnapshot, 0)

    let totalAgreed = new Decimal(0)
    let totalPaid = new Decimal(0)

    for (const trip of nonCancelledTrips) {
      const fin = calculateTripFinancials(trip.agreedAmount, trip.payments)
      totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
      totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
    }

    const totalRemaining = totalAgreed.minus(totalPaid)

    return {
      id: c.id,
      name: c.name,
      notes: c.notes,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      tripCount: nonCancelledTrips.length,
      busCount: uniqueBusIds.size,
      totalCapacity: totalSeferKapasite,
      capacityLabel: 'Sefer bazlı toplam yolcu koltuk kapasitesi',
      totalAgreedAmount: totalAgreed.toFixed(2),
      totalPaidAmount: totalPaid.toFixed(2),
      totalRemainingAmount: totalRemaining.toFixed(2),
    }
  })

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
})
