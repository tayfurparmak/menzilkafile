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
    const s = search.trim()
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { phone: { contains: s, mode: 'insensitive' } },
    ]
  }

  const [total, owners] = await Promise.all([
    prisma.vehicleOwner.count({ where }),
    prisma.vehicleOwner.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        buses: {
          select: { id: true, plate: true, capacity: true, isActive: true },
        },
        trips: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            id: true,
            agreedAmount: true,
            payments: { select: { amount: true } },
          },
        },
      },
    }),
  ])

  const items = owners.map((owner) => {
    let totalAgreed = new Decimal(0)
    let totalPaid = new Decimal(0)

    for (const trip of owner.trips) {
      const fin = calculateTripFinancials(trip.agreedAmount, trip.payments)
      totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
      totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
    }

    const totalRemaining = totalAgreed.minus(totalPaid)

    return {
      id: owner.id,
      name: owner.name,
      phone: owner.phone,
      notes: owner.notes,
      isActive: owner.isActive,
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
      busCount: owner.buses.length,
      activeBusCount: owner.buses.filter((b) => b.isActive).length,
      tripCount: owner.trips.length,
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
