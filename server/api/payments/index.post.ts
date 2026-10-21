import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { toDecimal } from '../../utils/business'
import { PaymentMethod, TripStatus } from '@prisma/client'
import Decimal from 'decimal.js'

const createPaymentSchema = z.object({
  tripId: z.string().min(1, 'Sefer seçilmelidir.'),
  amount: z.union([z.string(), z.number()]).refine(
    (val) => {
      try {
        const d = toDecimal(val)
        return d.greaterThan(0)
      } catch {
        return false
      }
    },
    { message: 'Ödeme tutarı 0’dan büyük bir sayı olmalıdır.' }
  ),
  paidAt: z.string().datetime({ message: 'Geçersiz ödeme tarihi.' }),
  method: z.nativeEnum(PaymentMethod),
  notes: z.string().trim().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const body = await readValidatedBody(event, (data) => createPaymentSchema.parse(data))
  const newAmount = toDecimal(body.amount)
  const paidAtDate = new Date(body.paidAt)

  // Transaction ve eşzamanlı fazla ödeme koruması (PostgreSQL FOR UPDATE kilidi)
  const payment = await prisma.$transaction(async (tx) => {
    // Eşzamanlı ödeme ve ücret değişikliklerini sıraya sokmak için Sefer kaydını kilitler
    const tripRows: any = await tx.$queryRawUnsafe(
      `SELECT id, "agreedAmount", status FROM "Trip" WHERE id = $1 FOR UPDATE;`,
      body.tripId
    )

    if (!tripRows || tripRows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'İlgili sefer bulunamadı.' })
    }

    const trip = tripRows[0]

    // İş kuralı: İptal edilmiş sefere ödeme eklenemez.
    if (trip.status === TripStatus.CANCELLED) {
      throw createError({
        statusCode: 400,
        statusMessage: 'İptal edilmiş bir sefere ödeme eklenemez.',
      })
    }

    // Seferin güncel ödemelerini transaction içinde sorgula
    const existingPayments = await tx.payment.findMany({
      where: { tripId: body.tripId },
    })

    // Mevcut ödemeler toplamı hesabı (Decimal.js ile hassas hesaplama)
    const agreedAmount = toDecimal(trip.agreedAmount)
    const currentPaid = existingPayments.reduce(
      (acc, p) => acc.plus(toDecimal(p.amount)),
      new Decimal(0)
    )
    const remainingBalance = agreedAmount.minus(currentPaid)

    // İş kuralı: Sefer toplam ödemesini aşan ödeme engellenmeli.
    if (newAmount.greaterThan(remainingBalance)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Ödeme tutarı (${newAmount.toFixed(2)} TL), seferin kalan borç tutarını (${remainingBalance.toFixed(2)} TL) aşamaz.`,
      })
    }

    return await tx.payment.create({
      data: {
        tripId: trip.id,
        amount: newAmount.toFixed(2),
        paidAt: paidAtDate,
        method: body.method,
        notes: body.notes || null,
      },
    })
  })

  return {
    success: true,
    data: {
      ...payment,
      amount: payment.amount.toString(),
    },
  }
})
