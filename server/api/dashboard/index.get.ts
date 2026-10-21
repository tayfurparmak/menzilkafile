import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuthUser } from '../../utils/auth'
import { calculateTripFinancials, getIstanbulDayRange, toDecimal } from '../../utils/business'
import { TripStatus } from '@prisma/client'
import Decimal from 'decimal.js'

const dashboardQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)

  const query = await getValidatedQuery(event, (data) => dashboardQuerySchema.parse(data))

  // 1. İstanbul saat dilimine göre "Bugün" sınırları
  const { startUtc: todayStartUtc, endUtc: todayEndUtc } = getIstanbulDayRange()

  // 2. Aktif otobüs sayısı
  const activeBusesCount = await prisma.bus.count({
    where: { isActive: true },
  })

  // 3. Bugün başlayan aktif sefer sayısı (İstanbul saatiyle)
  const todayTripsCount = await prisma.trip.count({
    where: {
      status: { not: TripStatus.CANCELLED },
      startsAt: {
        gte: todayStartUtc,
        lte: todayEndUtc,
      },
    },
  })

  // 4. Yoldaki sefer sayısı
  const onRoadTripsCount = await prisma.trip.count({
    where: { status: TripStatus.ON_ROAD },
  })

  // 5. Seçilen döneme ait mali filtre (Sefer başlangıç tarihine göre)
  const financialWhere: any = {
    status: { not: TripStatus.CANCELLED },
  }

  if (query.startDate || query.endDate) {
    financialWhere.startsAt = {}
    if (query.startDate) {
      financialWhere.startsAt.gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const endD = new Date(query.endDate)
      if (query.endDate.length === 10) endD.setHours(23, 59, 59, 999)
      financialWhere.startsAt.lte = endD
    }
  }

  // Dönemdeki seferler ve bağlı ödemeleri
  const periodTrips = await prisma.trip.findMany({
    where: financialWhere,
    select: {
      id: true,
      agreedAmount: true,
      payments: {
        select: { amount: true },
      },
    },
  })

  let totalAgreed = new Decimal(0)
  let totalPaid = new Decimal(0)

  for (const t of periodTrips) {
    const fin = calculateTripFinancials(t.agreedAmount, t.payments)
    totalAgreed = totalAgreed.plus(toDecimal(fin.agreedAmount))
    totalPaid = totalPaid.plus(toDecimal(fin.totalPaid))
  }

  const totalRemaining = totalAgreed.minus(totalPaid)

  // 6. Yaklaşan Seferler (En yakın 5 sefer)
  const now = new Date()
  const upcomingRawTrips = await prisma.trip.findMany({
    where: {
      status: { in: [TripStatus.PLANNED, TripStatus.ON_ROAD] },
      endsAt: { gte: now },
    },
    take: 5,
    orderBy: { startsAt: 'asc' },
    include: {
      convoy: { select: { id: true, name: true } },
      payments: { select: { amount: true } },
    },
  })

  const upcomingTrips = upcomingRawTrips.map((t) => {
    const fin = calculateTripFinancials(t.agreedAmount, t.payments)
    return {
      id: t.id,
      plate: t.plateSnapshot,
      capacity: t.capacitySnapshot,
      ownerName: t.ownerNameSnapshot,
      convoyName: t.convoy?.name || null,
      departureLocation: t.departureLocation,
      arrivalLocation: t.arrivalLocation,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      status: t.status,
      agreedAmount: fin.agreedAmount,
      totalPaid: fin.totalPaid,
      remainingAmount: fin.remainingAmount,
      paymentStatus: fin.status,
    }
  })

  // 7. Ödeme Bekleyen Seferler (Kalan borcu olan aktif seferler, en eski tarihliler önce)
  const unpaidRawTrips = await prisma.trip.findMany({
    where: {
      status: { not: TripStatus.CANCELLED },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      convoy: { select: { id: true, name: true } },
      payments: { select: { amount: true } },
    },
  })

  const unpaidTrips = unpaidRawTrips
    .map((t) => {
      const fin = calculateTripFinancials(t.agreedAmount, t.payments)
      return {
        id: t.id,
        plate: t.plateSnapshot,
        ownerName: t.ownerNameSnapshot,
        convoyName: t.convoy?.name || null,
        departureLocation: t.departureLocation,
        arrivalLocation: t.arrivalLocation,
        startsAt: t.startsAt,
        status: t.status,
        agreedAmount: fin.agreedAmount,
        totalPaid: fin.totalPaid,
        remainingAmount: fin.remainingAmount,
        paymentStatus: fin.status,
      }
    })
    .filter((t) => toDecimal(t.remainingAmount).greaterThan(0))
    .slice(0, 8)

  return {
    kpi: {
      activeBusesCount,
      todayTripsCount,
      onRoadTripsCount,
      totalAgreedAmount: totalAgreed.toFixed(2),
      totalPaidAmount: totalPaid.toFixed(2),
      totalRemainingAmount: totalRemaining.toFixed(2),
      periodExplanation:
        'Mali toplamlar; sefer başlangıç tarihi seçilen dönemde olan iptal edilmemiş seferleri ve yalnızca bu seferlere bağlı ödemeleri kapsar.',
    },
    upcomingTrips,
    unpaidTrips,
  }
})
