import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

const updateConvoySchema = z.object({
  name: z.string().trim().min(2, 'Kafile adı en az 2 karakter olmalıdır.').optional(),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Kafile ID belirtilmelidir.' })
  }

  const existing = await prisma.convoy.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Kafile bulunamadı.' })
  }

  const body = await readValidatedBody(event, (data) => updateConvoySchema.parse(data))

  const updated = await prisma.convoy.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  })

  return {
    success: true,
    data: updated,
  }
})
