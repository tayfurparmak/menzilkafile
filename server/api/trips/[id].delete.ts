import { requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  throw createError({
    statusCode: 400,
    statusMessage:
      'İş kuralı gereği seferler silinemez; operasyonel ve mali tutarlılık için yalnızca iptal edilebilir. Lütfen sefer durumunu "İptal" olarak güncelleyin.',
  })
})
