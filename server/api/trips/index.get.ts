import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials, sanitizeCsvCell, toDecimal } from '../../utils/business'
import { TripStatus } from '@prisma/client'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  plate: z.string().optional(),
  ownerId: z.string().optional(),
  convoyId: z.string().optional(),
  status: z.nativeEnum(TripStatus).or(z.literal('ALL')).default('ALL'),
  paymentStatus: z.enum(['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'NO_PAYMENT_REQUIRED']).default('ALL'),
  sortBy: z.enum(['startsAt', 'endsAt', 'agreedAmount', 'createdAt']).default('startsAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  format: z.enum(['json', 'csv']).default('json'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const query = await getValidatedQuery(event, (data) => querySchema.parse(data))
  const {
    startDate,
    endDate,
    plate,
    ownerId,
    convoyId,
    status,
    paymentStatus,
    sortBy,
    sortOrder,
    format,
    page,
    limit,
  } = query

  const where: any = {}

  if (status !== 'ALL') {
    where.status = status
  }

  if (ownerId) {
    where.ownerId = ownerId
  }

  if (convoyId) {
    where.convoyId = convoyId
  }

  if (plate && plate.trim() !== '') {
    where.plateSnapshot = { contains: plate.trim().toLocaleUpperCase('tr-TR'), mode: 'insensitive' }
  }

  if (startDate || endDate) {
    where.startsAt = {}
    if (startDate) {
      where.startsAt.gte = new Date(startDate)
    }
    if (endDate) {
      // Bitiş gününün sonuna kadar kapsamak için
      const endD = new Date(endDate)
      if (endDate.length === 10) {
        endD.setHours(23, 59, 59, 999)
      }
      where.startsAt.lte = endD
    }
  }

  // Varsayılan olarak yaklaşan seferler önce (startsAt artan)
  const isCsv = format === 'csv'
  const skip = isCsv ? 0 : (page - 1) * limit
  const take = isCsv ? 5000 : limit

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        bus: { select: { id: true, plate: true, capacity: true } },
        owner: { select: { id: true, name: true, phone: true } },
        convoy: { select: { id: true, name: true } },
        payments: {
          select: { id: true, amount: true, paidAt: true, method: true },
        },
      },
    }),
  ])

  // Parasal ve ödeme durumlarını dinamik hesapla
  let processedTrips = trips.map((trip) => {
    const fin = calculateTripFinancials(trip.agreedAmount, trip.payments)
    return {
      id: trip.id,
      plate: trip.plateSnapshot,
      capacity: trip.capacitySnapshot,
      ownerId: trip.ownerId,
      ownerName: trip.ownerNameSnapshot,
      driverName: trip.driverName || null,
      driverPhone: trip.driverPhone || null,
      convoyId: trip.convoyId,
      convoyName: trip.convoy?.name || null,
      departureLocation: trip.departureLocation,
      arrivalLocation: trip.arrivalLocation,
      startsAt: trip.startsAt,
      endsAt: trip.endsAt,
      status: trip.status,
      agreedAmount: fin.agreedAmount,
      totalPaid: fin.totalPaid,
      remainingAmount: fin.remainingAmount,
      paymentStatus: fin.status,
      notes: trip.notes,
      paymentCount: trip.payments.length,
      createdAt: trip.createdAt,
    }
  })

  // paymentStatus filtresi uygulanmışsa bellek içi filtrele (çünkü paymentStatus hesaplanan alandır)
  if (paymentStatus !== 'ALL') {
    processedTrips = processedTrips.filter((t) => t.paymentStatus.code === paymentStatus)
  }

  if (isCsv) {
    // CSV Dışa Aktarma
    const headers = [
      'Sefer ID',
      'Plaka',
      'Kapasite',
      'Araç Sahibi',
      'Otobüs Şoförü',
      'Şoför Telefonu',
      'Kafile',
      'Kalkış Yeri',
      'Varış Yeri',
      'Başlangıç Tarihi',
      'Bitiş Tarihi',
      'Sefer Durumu',
      'Anlaşılan Ücret (TL)',
      'Yapılan Ödeme (TL)',
      'Kalan Borç (TL)',
      'Ödeme Durumu',
    ]

    const statusMap: Record<TripStatus, string> = {
      PLANNED: 'Planlandı',
      ON_ROAD: 'Yolda',
      COMPLETED: 'Tamamlandı',
      CANCELLED: 'İptal',
    }

    const rows = processedTrips.map((t) => [
      sanitizeCsvCell(t.id),
      sanitizeCsvCell(t.plate),
      sanitizeCsvCell(t.capacity),
      sanitizeCsvCell(t.ownerName),
      sanitizeCsvCell(t.driverName || '-'),
      sanitizeCsvCell(t.driverPhone || '-'),
      sanitizeCsvCell(t.convoyName || '-'),
      sanitizeCsvCell(t.departureLocation),
      sanitizeCsvCell(t.arrivalLocation),
      sanitizeCsvCell(new Date(t.startsAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })),
      sanitizeCsvCell(new Date(t.endsAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })),
      sanitizeCsvCell(statusMap[t.status]),
      sanitizeCsvCell(t.agreedAmount),
      sanitizeCsvCell(t.totalPaid),
      sanitizeCsvCell(t.remainingAmount),
      sanitizeCsvCell(t.paymentStatus.label),
    ])

    const csvContent = '\uFEFF' + [headers.map(sanitizeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n')

    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="seferler_${new Date().toISOString().slice(0, 10)}.csv"`)
    return csvContent
  }

  return {
    items: processedTrips,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
})
