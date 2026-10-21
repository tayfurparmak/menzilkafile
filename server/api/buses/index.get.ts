import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

const querySchema = z.object({
  search: z.string().optional(),
  ownerId: z.string().optional(),
  capacity: z.coerce.number().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const query = await getValidatedQuery(event, (data) => querySchema.parse(data))
  const { search, ownerId, capacity, status, page, limit } = query
  const skip = (page - 1) * limit

  const where: any = {}

  if (status === 'active') where.isActive = true
  if (status === 'inactive') where.isActive = false
  if (ownerId) where.ownerId = ownerId
  if (capacity && [41, 46, 54].includes(capacity)) where.capacity = capacity

  if (search && search.trim() !== '') {
    const s = search.trim().toLocaleUpperCase('tr-TR')
    where.plate = { contains: s, mode: 'insensitive' }
  }

  const [total, buses] = await Promise.all([
    prisma.bus.count({ where }),
    prisma.bus.findMany({
      where,
      skip,
      take: limit,
      orderBy: { plate: 'asc' },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, isActive: true },
        },
        _count: {
          select: { trips: true },
        },
      },
    }),
  ])

  return {
    items: buses.map((b) => ({
      id: b.id,
      plate: b.plate,
      capacity: b.capacity,
      ownerId: b.ownerId,
      ownerName: b.owner.name,
      ownerPhone: b.owner.phone,
      isOwnerActive: b.owner.isActive,
      notes: b.notes,
      isActive: b.isActive,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      tripCount: b._count.trips,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
})
