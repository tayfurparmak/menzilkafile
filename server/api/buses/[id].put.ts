import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { normalizePlate, isValidCapacity } from '../../utils/business'

const updateBusSchema = z.object({
  plate: z.string().trim().min(3).optional(),
  capacity: z.coerce.number().refine(isValidCapacity, {
    message: 'Kapasite yalnızca 41, 46 veya 54 olabilir.',
  }).optional(),
  ownerId: z.string().min(1).optional(),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Otobüs ID belirtilmelidir.' })
  }

  const existingBus = await prisma.bus.findUnique({ where: { id } })
  if (!existingBus) {
    throw createError({ statusCode: 404, statusMessage: 'Otobüs bulunamadı.' })
  }

  const body = await readValidatedBody(event, (data) => updateBusSchema.parse(data))

  let normalizedPlate = existingBus.plate
  if (body.plate && body.plate !== existingBus.plate) {
    normalizedPlate = normalizePlate(body.plate)
    const duplicate = await prisma.bus.findFirst({
      where: {
        plate: normalizedPlate,
        id: { not: id },
      },
    })
    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: `"${normalizedPlate}" plakalı otobüs başka bir kayıtta mevcuttur.`,
      })
    }
  }

  if (body.ownerId && body.ownerId !== existingBus.ownerId) {
    const newOwner = await prisma.vehicleOwner.findUnique({
      where: { id: body.ownerId },
    })
    if (!newOwner) {
      throw createError({ statusCode: 404, statusMessage: 'Yeni araç sahibi bulunamadı.' })
    }
    if (!newOwner.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'Aktif olmayan bir araç sahibi atanamaz.' })
    }
  }

  // Otobüsün araç sahibi değişse dahi, eski seferlerin sahibi ve mali kayıtları değişmemeli.
  // Bu nedenle sadece Bus tablosundaki ownerId güncellenir, Trip tablosundaki tarihsel ownerId ve snapshot'lar korunur.
  const updated = await prisma.bus.update({
    where: { id },
    data: {
      plate: normalizedPlate,
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      ...(body.ownerId !== undefined ? { ownerId: body.ownerId } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: {
      owner: { select: { id: true, name: true } },
    },
  })

  return {
    success: true,
    data: updated,
  }
})
