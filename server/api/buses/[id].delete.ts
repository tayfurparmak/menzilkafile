import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Otobüs ID belirtilmelidir.' })
  }

  const bus = await prisma.bus.findUnique({
    where: { id },
    include: {
      _count: {
        select: { trips: true },
      },
    },
  })

  if (!bus) {
    throw createError({ statusCode: 404, statusMessage: 'Otobüs bulunamadı.' })
  }

  // İş kuralı: İlişkili kayıtları olan otobüs ve araç sahipleri silinmemeli; pasife alınmalı.
  if (bus._count.trips > 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'İlişkili sefer kayıtları bulunan otobüs silinemez. Lütfen aracı pasife alın.',
    })
  }

  await prisma.bus.delete({ where: { id } })

  return {
    success: true,
    message: 'Otobüs başarıyla silindi.',
  }
})
