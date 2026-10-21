import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Araç sahibi ID belirtilmelidir.' })
  }

  const owner = await prisma.vehicleOwner.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          buses: true,
          trips: true,
        },
      },
    },
  })

  if (!owner) {
    throw createError({ statusCode: 404, statusMessage: 'Araç sahibi bulunamadı.' })
  }

  // İş kuralı: İlişkili kayıtları olan otobüs ve araç sahipleri silinmemeli; pasife alınmalı.
  if (owner._count.buses > 0 || owner._count.trips > 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'İlişkili otobüs veya sefer kayıtları bulunan araç sahibi silinemez. Lütfen kaydı pasife alın.',
    })
  }

  await prisma.vehicleOwner.delete({ where: { id } })

  return {
    success: true,
    message: 'Araç sahibi başarıyla silindi.',
  }
})
