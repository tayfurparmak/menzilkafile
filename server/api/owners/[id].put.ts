import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

const updateOwnerSchema = z.object({
  name: z.string().trim().min(2, 'Araç sahibi adı en az 2 karakter olmalıdır.').optional(),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Araç sahibi ID belirtilmelidir.' })
  }

  const body = await readValidatedBody(event, (data) => updateOwnerSchema.parse(data))

  const existing = await prisma.vehicleOwner.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Araç sahibi bulunamadı.' })
  }

  const updated = await prisma.vehicleOwner.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  })

  return {
    success: true,
    data: updated,
  }
})
