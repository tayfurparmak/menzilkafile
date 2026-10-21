import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { normalizePlate, isValidCapacity } from '../../utils/business'

const createBusSchema = z.object({
  plate: z.string().trim().min(3, 'Plaka en az 3 karakter olmalıdır.'),
  capacity: z.coerce.number().refine(isValidCapacity, {
    message: 'Kapasite yalnızca 41, 46 veya 54 olabilir.',
  }),
  ownerId: z.string().min(1, 'Araç sahibi seçilmelidir.'),
  notes: z.string().trim().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const body = await readValidatedBody(event, (data) => createBusSchema.parse(data))
  const normalizedPlate = normalizePlate(body.plate)

  if (!normalizedPlate) {
    throw createError({ statusCode: 400, statusMessage: 'Geçersiz plaka biçimi.' })
  }

  // 1. Araç sahibi kontrolü
  const owner = await prisma.vehicleOwner.findUnique({
    where: { id: body.ownerId },
  })
  if (!owner) {
    throw createError({ statusCode: 404, statusMessage: 'Seçilen araç sahibi bulunamadı.' })
  }
  if (!owner.isActive) {
    throw createError({ statusCode: 400, statusMessage: 'Aktif olmayan bir araç sahibine otobüs eklenemez.' })
  }

  // 2. Mükerrer plaka kontrolü
  const existingBus = await prisma.bus.findUnique({
    where: { plate: normalizedPlate },
  })
  if (existingBus) {
    throw createError({
      statusCode: 409,
      statusMessage: `"${normalizedPlate}" plakalı otobüs zaten sistemde kayıtlıdır.`,
    })
  }

  const bus = await prisma.bus.create({
    data: {
      plate: normalizedPlate,
      capacity: body.capacity,
      ownerId: body.ownerId,
      notes: body.notes || null,
      isActive: true,
    },
    include: {
      owner: { select: { id: true, name: true } },
    },
  })

  return {
    success: true,
    data: bus,
  }
})
