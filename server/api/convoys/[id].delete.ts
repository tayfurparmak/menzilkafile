import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Kafile ID belirtilmelidir.' })
  }

  const convoy = await prisma.convoy.findUnique({
    where: { id },
    include: { _count: { select: { trips: true } } },
  })

  if (!convoy) {
    throw createError({ statusCode: 404, statusMessage: 'Kafile bulunamadı.' })
  }

  if (convoy._count.trips > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bağlı seferleri bulunan kafile silinemez. Lütfen kafileyi pasife alın.',
    })
  }

  await prisma.convoy.delete({ where: { id } })

  return {
    success: true,
    message: 'Kafile başarıyla silindi.',
  }
})
