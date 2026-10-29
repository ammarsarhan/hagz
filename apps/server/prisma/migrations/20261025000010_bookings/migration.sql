-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'HELD', 'UNCONFIRMED', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'RELEASED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReschedulingType" AS ENUM ('MOVE', 'SWAP', 'REFILL');

-- CreateEnum
CREATE TYPE "BookingChargeType" AS ENUM ('SLOT', 'AMENITY', 'DISCOUNT', 'REWARD');

-- CreateEnum
CREATE TYPE "CancellationActor" AS ENUM ('CUSTOMER', 'VENUE', 'ADMIN');

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "groundId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "creatorId" UUID,
    "regularId" UUID,
    "code" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "idempotencyKey" UUID,
    "total" INTEGER NOT NULL,
    "depositAmount" INTEGER,
    "paymentMode" "PaymentMode" NOT NULL,
    "commissionRate" INTEGER NOT NULL,
    "cancellationPolicy" "CancellationPolicy" NOT NULL,
    "cancellationTiers" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cancellation" (
    "bookingId" UUID NOT NULL,
    "initiator" "CancellationActor" NOT NULL,
    "reason" TEXT,
    "refundPercent" INTEGER NOT NULL,
    "refundAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cancellation_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "BookingCharge" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "type" "BookingChargeType" NOT NULL,
    "startsAt" TIMESTAMPTZ,
    "tier" "PriceTier",
    "optionId" UUID,
    "discountId" UUID,
    "pricing" "AmenityPricing",
    "amount" INTEGER NOT NULL,
    "taxRate" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "staffId" UUID,
    "customerId" UUID,
    "adminId" UUID,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rescheduling" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "fromBookingId" UUID NOT NULL,
    "toBookingId" UUID NOT NULL,
    "type" "ReschedulingType" NOT NULL,
    "groupId" UUID,
    "staffId" UUID,
    "reason" TEXT,
    "priceDifference" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rescheduling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_code_key" ON "Booking"("code");

-- CreateIndex
CREATE INDEX "Booking_venueId_startsAt_idx" ON "Booking"("venueId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_groundId_startsAt_idx" ON "Booking"("groundId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_customerId_startsAt_idx" ON "Booking"("customerId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_id_venueId_key" ON "Booking"("id", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_id_customerId_key" ON "Booking"("id", "customerId");

-- CreateIndex
CREATE INDEX "BookingCharge_optionId_idx" ON "BookingCharge"("optionId");

-- CreateIndex
CREATE INDEX "BookingCharge_discountId_idx" ON "BookingCharge"("discountId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCharge_bookingId_startsAt_key" ON "BookingCharge"("bookingId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCharge_bookingId_optionId_key" ON "BookingCharge"("bookingId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCharge_discount_key" ON "BookingCharge"("bookingId") WHERE ("type" = 'DISCOUNT');

-- CreateIndex
CREATE UNIQUE INDEX "BookingCharge_reward_key" ON "BookingCharge"("bookingId") WHERE ("type" = 'REWARD');

-- CreateIndex
CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_venueId_idempotencyKey_key" ON "Booking"("venueId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_regularId_startsAt_key" ON "Booking"("regularId", "startsAt");

-- CreateIndex
CREATE INDEX "Rescheduling_fromBookingId_idx" ON "Rescheduling"("fromBookingId");

-- CreateIndex
CREATE INDEX "Rescheduling_groupId_idx" ON "Rescheduling"("groupId");

-- CreateIndex
CREATE INDEX "Rescheduling_venueId_type_createdAt_idx" ON "Rescheduling"("venueId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rescheduling_toBookingId_venueId_key" ON "Rescheduling"("toBookingId", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Rescheduling_from_move_key" ON "Rescheduling"("fromBookingId") WHERE ("type" != 'REFILL');

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_groundId_venueId_fkey" FOREIGN KEY ("groundId", "venueId") REFERENCES "Ground"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_venueId_fkey" FOREIGN KEY ("customerId", "venueId") REFERENCES "VenueCustomer"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancellation" ADD CONSTRAINT "Cancellation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCharge" ADD CONSTRAINT "BookingCharge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCharge" ADD CONSTRAINT "BookingCharge_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AmenityOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCharge" ADD CONSTRAINT "BookingCharge_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "VenueDiscount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_bookingId_venueId_fkey" FOREIGN KEY ("bookingId", "venueId") REFERENCES "Booking"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReview" ADD CONSTRAINT "VenueReview_bookingId_customerId_fkey" FOREIGN KEY ("bookingId", "customerId") REFERENCES "Booking"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescheduling" ADD CONSTRAINT "Rescheduling_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescheduling" ADD CONSTRAINT "Rescheduling_fromBookingId_venueId_fkey" FOREIGN KEY ("fromBookingId", "venueId") REFERENCES "Booking"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescheduling" ADD CONSTRAINT "Rescheduling_toBookingId_venueId_fkey" FOREIGN KEY ("toBookingId", "venueId") REFERENCES "Booking"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescheduling" ADD CONSTRAINT "Rescheduling_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_range_check"
  CHECK ("endsAt" > "startsAt");

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_total_check"
  CHECK (total >= 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_actor_check"
  CHECK (num_nonnulls("staffId", "customerId", "adminId") <= 1);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "BookingCharge" ADD CONSTRAINT "BookingCharge_kind_check" CHECK (
  (type = 'SLOT' AND "startsAt" IS NOT NULL AND tier IS NOT NULL AND "optionId" IS NULL AND pricing IS NULL AND "discountId" IS NULL AND amount >= 0)
  OR (type = 'AMENITY' AND "optionId" IS NOT NULL AND "startsAt" IS NULL AND tier IS NULL AND "discountId" IS NULL AND amount >= 0)
  OR (type = 'DISCOUNT' AND "discountId" IS NOT NULL AND "startsAt" IS NULL AND tier IS NULL AND "optionId" IS NULL AND pricing IS NULL AND amount < 0)
  OR (type = 'REWARD' AND "discountId" IS NULL AND "startsAt" IS NULL AND tier IS NULL AND "optionId" IS NULL AND pricing IS NULL AND amount < 0)
);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "BookingCharge" ADD CONSTRAINT "BookingCharge_tax_check" CHECK ("taxRate" BETWEEN 0 AND 10000 AND ((amount >= 0 AND "taxAmount" BETWEEN 0 AND amount) OR (amount < 0 AND "taxAmount" BETWEEN amount AND 0)) AND ("taxRate" > 0 OR "taxAmount" = 0));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_deposit_check" CHECK ((("paymentMode" = 'DEPOSIT') = ("depositAmount" IS NOT NULL)) AND ("depositAmount" IS NULL OR "depositAmount" BETWEEN 1 AND total));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_commission_check" CHECK ("commissionRate" BETWEEN 0 AND 10000 AND ("creatorId" IS NULL OR "commissionRate" = 0));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cancellation_check" CHECK (jsonb_typeof("cancellationTiers") = 'array');

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Cancellation" ADD CONSTRAINT "Cancellation_refund_check" CHECK ("refundPercent" BETWEEN 0 AND 100 AND "refundAmount" >= 0 AND (initiator <> 'VENUE' OR "refundPercent" = 100));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
-- A regular's reservation is paid at the venue with no commission. UNCONFIRMED and RELEASED belong to
-- regulars only, and UNCONFIRMED has its confirmation deadline.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_regular_check" CHECK (("regularId" IS NULL OR ("paymentMode" = 'MANUAL' AND "commissionRate" = 0)) AND (status NOT IN ('UNCONFIRMED', 'RELEASED') OR "regularId" IS NOT NULL) AND (status <> 'UNCONFIRMED' OR "expiresAt" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Rescheduling" ADD CONSTRAINT "Rescheduling_values_check" CHECK ("fromBookingId" <> "toBookingId" AND (type = 'SWAP') = ("groupId" IS NOT NULL) AND (type = 'REFILL') = ("priceDifference" IS NULL));
