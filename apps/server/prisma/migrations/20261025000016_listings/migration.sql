-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingPlayerStatus" AS ENUM ('JOINED', 'LEFT', 'REMOVED');

-- CreateTable
CREATE TABLE "BookingListing" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'OPEN',
    "neededPlayers" SMALLINT NOT NULL,
    "playerCount" SMALLINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "costShare" INTEGER,
    "closedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BookingListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPlayer" (
    "listingId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "ListingPlayerStatus" NOT NULL DEFAULT 'JOINED',
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ,
    "noShowReportedAt" TIMESTAMPTZ,

    CONSTRAINT "ListingPlayer_pkey" PRIMARY KEY ("listingId","customerId")
);

-- CreateIndex
CREATE INDEX "BookingListing_status_startsAt_idx" ON "BookingListing"("status", "startsAt");

-- CreateIndex
CREATE INDEX "BookingListing_venueId_startsAt_idx" ON "BookingListing"("venueId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingListing_bookingId_venueId_key" ON "BookingListing"("bookingId", "venueId");

-- CreateIndex
CREATE INDEX "ListingPlayer_customerId_idx" ON "ListingPlayer"("customerId");

-- AddForeignKey
ALTER TABLE "BookingListing" ADD CONSTRAINT "BookingListing_bookingId_venueId_fkey" FOREIGN KEY ("bookingId", "venueId") REFERENCES "Booking"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingListing" ADD CONSTRAINT "BookingListing_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPlayer" ADD CONSTRAINT "ListingPlayer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "BookingListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPlayer" ADD CONSTRAINT "ListingPlayer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
-- playerCount never passes neededPlayers, so the booker can only lower it to the number joined.
ALTER TABLE "BookingListing" ADD CONSTRAINT "BookingListing_players_check" CHECK ("neededPlayers" >= 1 AND "playerCount" BETWEEN 0 AND "neededPlayers" AND ("costShare" IS NULL OR "costShare" >= 0));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "BookingListing" ADD CONSTRAINT "BookingListing_closed_check" CHECK ((status = 'OPEN') = ("closedAt" IS NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "ListingPlayer" ADD CONSTRAINT "ListingPlayer_status_check" CHECK ((status = 'JOINED') = ("leftAt" IS NULL) AND ("noShowReportedAt" IS NULL OR status = 'JOINED'));
