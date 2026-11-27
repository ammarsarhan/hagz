-- CreateEnum
CREATE TYPE "GroundSport" AS ENUM ('FOOTBALL', 'PADEL', 'TENNIS', 'BASKETBALL', 'VOLLEYBALL');

-- CreateEnum
CREATE TYPE "GroundSize" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE', 'STANDARD');

-- CreateEnum
CREATE TYPE "GroundSurface" AS ENUM ('NATURAL_GRASS', 'ARTIFICIAL_TURF', 'HARD_WOOD', 'HARD_COURT', 'CLAY', 'SAND', 'OTHER');

-- CreateEnum
CREATE TYPE "GroundEnvironment" AS ENUM ('INDOOR', 'OUTDOOR', 'COVERED');

-- CreateEnum
CREATE TYPE "GroundStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'REMOVING', 'DELETED');

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('BASE', 'PEAK', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED');

-- CreateTable
CREATE TABLE "Ground" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "sport" "GroundSport" NOT NULL,
    "size" "GroundSize" NOT NULL,
    "surface" "GroundSurface" NOT NULL,
    "environment" "GroundEnvironment" NOT NULL,
    "status" "GroundStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "peakPrice" INTEGER,
    "discountPrice" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Ground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroundTranslation" (
    "groundId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "GroundTranslation_pkey" PRIMARY KEY ("groundId","language")
);

-- CreateTable
CREATE TABLE "GroundSettings" (
    "groundId" UUID NOT NULL,
    "minimumSlots" INTEGER NOT NULL DEFAULT 1,
    "maximumSlots" INTEGER NOT NULL DEFAULT 3,
    "generatedUntil" TIMESTAMPTZ,
    "generatedAt" TIMESTAMPTZ,
    "scheduleVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GroundSettings_pkey" PRIMARY KEY ("groundId")
);

-- CreateTable
CREATE TABLE "GroundSchedule" (
    "groundId" UUID NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "hours" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GroundSchedule_pkey" PRIMARY KEY ("groundId","dayOfWeek")
);

-- CreateTable
CREATE TABLE "GroundSlot" (
    "id" UUID NOT NULL,
    "groundId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "tier" "PriceTier" NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "scheduleVersion" INTEGER NOT NULL,
    "bookingId" UUID,
    "freedAt" TIMESTAMPTZ,
    "blockNote" TEXT,
    "blockedById" UUID,
    "blockedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GroundSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotWaitlist" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "groundId" UUID,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "lastNotifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ground_venueId_position_idx" ON "Ground"("venueId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Ground_id_venueId_key" ON "Ground"("id", "venueId");

-- CreateIndex
CREATE INDEX "GroundSlot_venueId_startsAt_idx" ON "GroundSlot"("venueId", "startsAt");

-- CreateIndex
CREATE INDEX "GroundSlot_bookingId_idx" ON "GroundSlot"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "GroundSlot_groundId_startsAt_key" ON "GroundSlot"("groundId", "startsAt");

-- CreateIndex
CREATE INDEX "SlotWaitlist_venueId_startsAt_idx" ON "SlotWaitlist"("venueId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlotWaitlist_any_ground_key" ON "SlotWaitlist"("customerId", "venueId", "startsAt") WHERE ("groundId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "SlotWaitlist_ground_key" ON "SlotWaitlist"("customerId", "groundId", "startsAt") WHERE ("groundId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "Ground" ADD CONSTRAINT "Ground_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundTranslation" ADD CONSTRAINT "GroundTranslation_groundId_fkey" FOREIGN KEY ("groundId") REFERENCES "Ground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundSettings" ADD CONSTRAINT "GroundSettings_groundId_fkey" FOREIGN KEY ("groundId") REFERENCES "Ground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundSchedule" ADD CONSTRAINT "GroundSchedule_groundId_fkey" FOREIGN KEY ("groundId") REFERENCES "Ground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_groundId_venueId_fkey" FOREIGN KEY ("groundId", "venueId") REFERENCES "Ground"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotWaitlist" ADD CONSTRAINT "SlotWaitlist_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotWaitlist" ADD CONSTRAINT "SlotWaitlist_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotWaitlist" ADD CONSTRAINT "SlotWaitlist_groundId_venueId_fkey" FOREIGN KEY ("groundId", "venueId") REFERENCES "Ground"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "GroundSettings" ADD CONSTRAINT "GroundSettings_slots_check"
  CHECK ("minimumSlots" >= 1 AND "maximumSlots" >= "minimumSlots");

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "GroundSettings" ADD CONSTRAINT "GroundSettings_horizon_check"
  CHECK ("generatedUntil" <= now() + interval '90 days');

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "GroundSchedule" ADD CONSTRAINT "GroundSchedule_day_check"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_range_check"
  CHECK ("endsAt" > "startsAt");

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_horizon_check"
  CHECK ("startsAt" <= now() + interval '90 days');

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_booking_check"
  CHECK (("bookingId" IS NOT NULL) = (status IN ('HELD', 'BOOKED')));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints). A closed hour's note, who closed
-- it and when belong to a BLOCKED slot only: opening it again clears them.
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_block_check"
  CHECK (status = 'BLOCKED' OR ("blockNote" IS NULL AND "blockedById" IS NULL AND "blockedAt" IS NULL));

-- AddExclusion (hand-added: Prisma cannot declare exclusion constraints). No two slots on a ground
-- overlap in time: a staff-added 10:30–12:00 slot can't sit across the generated 11:00 one.
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_no_overlap"
  EXCLUDE USING gist ("groundId" WITH =, tstzrange("startsAt", "endsAt") WITH &&);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "SlotWaitlist" ADD CONSTRAINT "SlotWaitlist_range_check" CHECK ("endsAt" > "startsAt");
