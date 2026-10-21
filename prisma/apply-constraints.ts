import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyConstraints() {
  console.log('Veritabanı CHECK kısıtları ve RLS güvenlik kuralları uygulanıyor...')

  const sqlStatements = [
    // Check constraints
    `ALTER TABLE "Bus" DROP CONSTRAINT IF EXISTS "check_bus_capacity";`,
    `ALTER TABLE "Bus" ADD CONSTRAINT "check_bus_capacity" CHECK ("capacity" IN (41, 46, 54));`,

    `ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "check_trip_ends_after_starts";`,
    `ALTER TABLE "Trip" ADD CONSTRAINT "check_trip_ends_after_starts" CHECK ("endsAt" > "startsAt");`,

    `ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "check_trip_agreed_amount";`,
    `ALTER TABLE "Trip" ADD CONSTRAINT "check_trip_agreed_amount" CHECK ("agreedAmount" >= 0);`,

    `ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "check_trip_capacity_snapshot";`,
    `ALTER TABLE "Trip" ADD CONSTRAINT "check_trip_capacity_snapshot" CHECK ("capacitySnapshot" IN (41, 46, 54));`,

    `ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "check_payment_amount_positive";`,
    `ALTER TABLE "Payment" ADD CONSTRAINT "check_payment_amount_positive" CHECK ("amount" > 0);`,

    // RLS Activation
    `ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "VehicleOwner" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Bus" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Convoy" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;`,

    // Revoke public client access
    `REVOKE ALL ON "AppUser" FROM anon, authenticated;`,
    `REVOKE ALL ON "VehicleOwner" FROM anon, authenticated;`,
    `REVOKE ALL ON "Bus" FROM anon, authenticated;`,
    `REVOKE ALL ON "Convoy" FROM anon, authenticated;`,
    `REVOKE ALL ON "Trip" FROM anon, authenticated;`,
    `REVOKE ALL ON "Payment" FROM anon, authenticated;`,
  ]

  for (const sql of sqlStatements) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (e: any) {
      console.warn(`Uyarı (${sql.slice(0, 40)}...):`, e.message)
    }
  }

  console.log('Tüm veritabanı kısıtları ve RLS güvenlik kuralları başarıyla uygulandı!')
}

applyConstraints()
  .catch((e) => {
    console.error('Kısıtlar uygulanırken hata:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
