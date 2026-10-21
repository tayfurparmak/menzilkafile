import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

const createOwnerSchema = z.object({
  name: z.string().trim().min(2, 'Araç sahibi adı en az 2 karakter olmalıdır.'),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const body = await readValidatedBody(event, (data) => createOwnerSchema.parse(data))

  const owner = await prisma.vehicleOwner.create({
    data: {
      name: body.name,
      phone: body.phone || null,
      notes: body.notes || null,
      isActive: true,
    },
  })

  return {
    success: true,
    data: owner,
  }
})
