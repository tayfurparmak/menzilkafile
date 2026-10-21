import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { toDecimal } from '../../utils/business'
import { PaymentMethod, TripStatus } from '@prisma/client'
import Decimal from 'decimal.js'

const updatePaymentSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .refine(
      (val) => {
        try {
          const d = toDecimal(val)
          return d.greaterThan(0)
        } catch {
          return false
        }
      },
      { message: 'Ödeme tutarı 0’dan büyük bir sayı olmalıdır.' }
    )
    .optional(),
  paidAt: z.string().datetime().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().trim().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Ödeme ID belirtilmelidir.' })
  }

  const body = await readValidatedBody(event, (data) => updatePaymentSchema.parse(data))

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id },
    })

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Ödeme kaydı bulunamadı.' })
    }

    // Eşzamanlı yarış durumlarını önlemek için sefer kaydını FOR UPDATE ile kilitler
    const tripRows: any = await tx.$queryRawUnsafe(
      `SELECT id, "agreedAmount", status FROM "Trip" WHERE id = $1 FOR UPDATE;`,
      existing.tripId
    )

    if (!tripRows || tripRows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'İlgili sefer bulunamadı.' })
    }

    const trip = tripRows[0]

    if (trip.status === TripStatus.CANCELLED) {
      throw createError({ statusCode: 400, statusMessage: 'İptal edilmiş bir seferin ödemesi düzenlenemez.' })
    }

    let newAmount = toDecimal(existing.amount)
    if (body.amount !== undefined) {
      newAmount = toDecimal(body.amount)
      const agreed = toDecimal(trip.agreedAmount)

      // Seferin güncel ödemelerini transaction içinde al
      const allTripPayments = await tx.payment.findMany({
        where: { tripId: existing.tripId },
      })

      // Bu ödeme dışındaki diğer ödemelerin toplamı
      const otherPaymentsTotal = allTripPayments
        .filter((p) => p.id !== id)
        .reduce((acc, p) => acc.plus(toDecimal(p.amount)), new Decimal(0))

      const maxAllowed = agreed.minus(otherPaymentsTotal)

      if (newAmount.greaterThan(maxAllowed)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Güncellenen ödeme tutarı (${newAmount.toFixed(2)} TL), sefer için ödenebilecek azami tutarı (${maxAllowed.toFixed(2)} TL) aşamaz.`,
        })
      }
    }

    return await tx.payment.update({
      where: { id },
      data: {
        ...(body.amount !== undefined ? { amount: newAmount.toFixed(2) } : {}),
        ...(body.paidAt !== undefined ? { paidAt: new Date(body.paidAt) } : {}),
        ...(body.method !== undefined ? { method: body.method } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    })
  })

  return {
    success: true,
    data: {
      ...updatedPayment,
      amount: updatedPayment.amount.toString(),
    },
  }
})
