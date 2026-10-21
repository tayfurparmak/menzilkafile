import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

const createConvoySchema = z.object({
  name: z.string().trim().min(2, 'Kafile adı en az 2 karakter olmalıdır.'),
  notes: z.string().trim().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const body = await readValidatedBody(event, (data) => createConvoySchema.parse(data))

  const convoy = await prisma.convoy.create({
    data: {
      name: body.name,
      notes: body.notes || null,
      isActive: true,
    },
  })

  return {
    success: true,
    data: convoy,
  }
})
