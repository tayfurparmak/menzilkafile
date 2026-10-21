import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Ödeme ID belirtilmelidir.' })
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { id } })
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Ödeme kaydı bulunamadı.' })
    }

    // Sefer kaydı üzerinde kilit al
    await tx.$queryRawUnsafe(`SELECT id FROM "Trip" WHERE id = $1 FOR UPDATE;`, existing.tripId)

    await tx.payment.delete({ where: { id } })
  })

  return {
    success: true,
    message: 'Ödeme kaydı başarıyla silindi.',
  }
})
