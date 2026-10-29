-- CreateTable
CREATE TABLE "VenueRegular" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "groundId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "startHour" SMALLINT NOT NULL,
    "slotCount" SMALLINT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "pausedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueRegular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderToken" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueRegular_venueId_idx" ON "VenueRegular"("venueId");

-- CreateIndex
CREATE INDEX "VenueRegular_groundId_idx" ON "VenueRegular"("groundId");

-- CreateIndex
CREATE INDEX "VenueRegular_customerId_idx" ON "VenueRegular"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueRegular_id_venueId_key" ON "VenueRegular"("id", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderToken_tokenHash_key" ON "ReminderToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ReminderToken_bookingId_idx" ON "ReminderToken"("bookingId");

-- AddForeignKey
ALTER TABLE "VenueRegular" ADD CONSTRAINT "VenueRegular_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueRegular" ADD CONSTRAINT "VenueRegular_groundId_venueId_fkey" FOREIGN KEY ("groundId", "venueId") REFERENCES "Ground"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueRegular" ADD CONSTRAINT "VenueRegular_customerId_venueId_fkey" FOREIGN KEY ("customerId", "venueId") REFERENCES "VenueCustomer"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueRegular" ADD CONSTRAINT "VenueRegular_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_regularId_venueId_fkey" FOREIGN KEY ("regularId", "venueId") REFERENCES "VenueRegular"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderToken" ADD CONSTRAINT "ReminderToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueRegular" ADD CONSTRAINT "VenueRegular_values_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6 AND "startHour" BETWEEN 0 AND 23 AND "slotCount" >= 1 AND ("endsOn" IS NULL OR "endsOn" >= "startsOn"));
