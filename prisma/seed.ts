import { PrismaClient, TripStatus, PaymentMethod } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview'
  ) {
    console.error('HATA: Seed betiği üretim (production / Vercel) ortamında çalıştırılamaz!')
    process.exit(1)
  }

  console.log('Geliştirme ortamı için örnek veriler yükleniyor...')

  // 1. Örnek Sistem Yöneticisi Kullanıcısı
  const adminUser = await prisma.appUser.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      displayName: 'Sistem Yöneticisi',
      isActive: true,
    },
  })

  // 2. Örnek Araç Sahibi: Mehmet Yılmaz
  const owner = await prisma.vehicleOwner.upsert({
    where: { id: 'seed-owner-mehmet-yilmaz' },
    update: {},
    create: {
      id: 'seed-owner-mehmet-yilmaz',
      name: 'Mehmet Yılmaz',
      phone: '0555 123 4567',
      notes: 'Güvenilir araç sahibi, Ege bölgesi operasyonları',
      isActive: true,
    },
  })

  // 3. Örnek Otobüs: 35 ABC 123 (46 Kişilik)
  const bus = await prisma.bus.upsert({
    where: { plate: '35 ABC 123' },
    update: {},
    create: {
      id: 'seed-bus-35-abc-123',
      plate: '35 ABC 123',
      capacity: 46,
      ownerId: owner.id,
      notes: 'Travego 16 SHD - 2022 Model',
      isActive: true,
    },
  })

  // 4. Örnek Kafile: Kasım Kafilesi
  const convoy = await prisma.convoy.upsert({
    where: { id: 'seed-convoy-kasim' },
    update: {},
    create: {
      id: 'seed-convoy-kasim',
      name: 'Kasım Kafilesi',
      notes: '2026 Yılı Kasım Ayı Kültür Gezisi ve Ziyaret Kafilesi',
      isActive: true,
    },
  })

  // 5. Örnek Sefer: İzmir -> Konya (18.000 TL)
  const now = new Date()
  const tripStartsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Yarın
  const tripEndsAt = new Date(tripStartsAt.getTime() + 8 * 60 * 60 * 1000) // 8 saat sonra

  const trip = await prisma.trip.upsert({
    where: { id: 'seed-trip-izmir-konya' },
    update: {},
    create: {
      id: 'seed-trip-izmir-konya',
      convoyId: convoy.id,
      busId: bus.id,
      ownerId: owner.id,
      plateSnapshot: bus.plate,
      capacitySnapshot: bus.capacity,
      ownerNameSnapshot: owner.name,
      departureLocation: 'İzmir',
      arrivalLocation: 'Konya',
      startsAt: tripStartsAt,
      endsAt: tripEndsAt,
      status: TripStatus.PLANNED,
      agreedAmount: '18000.00',
      notes: 'İzmir Otogar kalkışlı, Konya Mevlana Meydanı varışlı',
    },
  })

  // 6. Örnek Ödeme: 5.000 TL (Bakiye Kalan: 13.000 TL)
  await prisma.payment.upsert({
    where: { id: 'seed-payment-5000' },
    update: {},
    create: {
      id: 'seed-payment-5000',
      tripId: trip.id,
      amount: '5000.00',
      paidAt: now,
      method: PaymentMethod.BANK_TRANSFER,
      notes: 'Ön avans ödemesi (Garanti Bankası Havale)',
    },
  })

  console.log('Örnek veriler başarıyla yüklendi:')
  console.log(`- Yönetici: ${adminUser.displayName}`)
  console.log(`- Araç Sahibi: ${owner.name}`)
  console.log(`- Otobüs: ${bus.plate} (${bus.capacity} Kişilik)`)
  console.log(`- Kafile: ${convoy.name}`)
  console.log(`- Sefer: ${trip.departureLocation} -> ${trip.arrivalLocation} (Ücret: 18.000 TL)`)
  console.log(`- Ödeme: 5.000 TL yapıldı -> Kalan: 13.000 TL`)
}

main()
  .catch((e) => {
    console.error('Seed sırasında hata oluştu:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
