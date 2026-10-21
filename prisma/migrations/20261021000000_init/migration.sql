-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PLANNED', 'ON_ROAD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH');

-- CreateTable
CREATE TABLE "AppUser" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleOwner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_bus_capacity" CHECK ("capacity" IN (41, 46, 54))
);

-- CreateTable
CREATE TABLE "Convoy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convoy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "convoyId" TEXT,
    "busId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "plateSnapshot" TEXT NOT NULL,
    "capacitySnapshot" INTEGER NOT NULL,
    "ownerNameSnapshot" TEXT NOT NULL,
    "departureLocation" TEXT NOT NULL,
    "arrivalLocation" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'PLANNED',
    "agreedAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_trip_ends_after_starts" CHECK ("endsAt" > "startsAt"),
    CONSTRAINT "check_trip_agreed_amount" CHECK ("agreedAmount" >= 0),
    CONSTRAINT "check_trip_capacity_snapshot" CHECK ("capacitySnapshot" IN (41, 46, 54))
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_payment_amount_positive" CHECK ("amount" > 0)
);

-- CreateIndex
CREATE INDEX "AppUser_isActive_idx" ON "AppUser"("isActive");

-- CreateIndex
CREATE INDEX "VehicleOwner_isActive_idx" ON "VehicleOwner"("isActive");
CREATE INDEX "VehicleOwner_name_idx" ON "VehicleOwner"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_plate_key" ON "Bus"("plate");
CREATE INDEX "Bus_ownerId_idx" ON "Bus"("ownerId");
CREATE INDEX "Bus_isActive_idx" ON "Bus"("isActive");

-- CreateIndex
CREATE INDEX "Convoy_isActive_idx" ON "Convoy"("isActive");

-- CreateIndex
CREATE INDEX "Trip_busId_idx" ON "Trip"("busId");
CREATE INDEX "Trip_ownerId_idx" ON "Trip"("ownerId");
CREATE INDEX "Trip_convoyId_idx" ON "Trip"("convoyId");
CREATE INDEX "Trip_startsAt_idx" ON "Trip"("startsAt");
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "Payment_tripId_idx" ON "Payment"("tripId");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "VehicleOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_convoyId_fkey" FOREIGN KEY ("convoyId") REFERENCES "Convoy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "VehicleOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable Row Level Security (RLS) on all business tables
ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VehicleOwner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Convoy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

-- Revoke direct table access from Supabase client roles (anon, authenticated)
-- Only server-side Prisma via direct/pooler connection can access business tables
REVOKE ALL ON "AppUser" FROM anon, authenticated;
REVOKE ALL ON "VehicleOwner" FROM anon, authenticated;
REVOKE ALL ON "Bus" FROM anon, authenticated;
REVOKE ALL ON "Convoy" FROM anon, authenticated;
REVOKE ALL ON "Trip" FROM anon, authenticated;
REVOKE ALL ON "Payment" FROM anon, authenticated;
