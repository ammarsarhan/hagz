-- CreateEnum
CREATE TYPE "LoyaltyCardStatus" AS ENUM ('OPEN', 'EARNED', 'REDEEMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "LoyaltyCard" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "LoyaltyCardStatus" NOT NULL DEFAULT 'OPEN',
    "requiredStamps" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "bookingId" UUID,
    "restoredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LoyaltyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyStamp" (
    "bookingId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyStamp_pkey" PRIMARY KEY ("bookingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_bookingId_key" ON "LoyaltyCard"("bookingId");

-- CreateIndex
CREATE INDEX "LoyaltyCard_status_expiresAt_idx" ON "LoyaltyCard"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_id_customerId_key" ON "LoyaltyCard"("id", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_bookingId_customerId_key" ON "LoyaltyCard"("bookingId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_open_key" ON "LoyaltyCard"("customerId") WHERE (status = ANY (ARRAY['OPEN'::"LoyaltyCardStatus", 'EARNED'::"LoyaltyCardStatus"]));

-- CreateIndex
CREATE INDEX "LoyaltyStamp_cardId_idx" ON "LoyaltyStamp"("cardId");

-- CreateIndex
CREATE INDEX "LoyaltyStamp_customerId_idx" ON "LoyaltyStamp"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyStamp_bookingId_customerId_key" ON "LoyaltyStamp"("bookingId", "customerId");

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "VenueCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_bookingId_customerId_fkey" FOREIGN KEY ("bookingId", "customerId") REFERENCES "Booking"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyStamp" ADD CONSTRAINT "LoyaltyStamp_bookingId_customerId_fkey" FOREIGN KEY ("bookingId", "customerId") REFERENCES "Booking"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyStamp" ADD CONSTRAINT "LoyaltyStamp_cardId_customerId_fkey" FOREIGN KEY ("cardId", "customerId") REFERENCES "LoyaltyCard"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyStamp" ADD CONSTRAINT "LoyaltyStamp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "VenueCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_stamps_check" CHECK ("requiredStamps" >= 2);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_redeemed_check" CHECK ((status = 'REDEEMED') = ("bookingId" IS NOT NULL));
