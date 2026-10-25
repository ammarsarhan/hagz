-- CreateTable
CREATE TABLE "VenueDiscount" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "percent" INTEGER,
    "amount" INTEGER,
    "maximumUses" INTEGER,
    "expiresAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "creatorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueDiscount_creatorId_idx" ON "VenueDiscount"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueDiscount_venueId_code_key" ON "VenueDiscount"("venueId", "code");

-- AddForeignKey
ALTER TABLE "VenueDiscount" ADD CONSTRAINT "VenueDiscount_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueDiscount" ADD CONSTRAINT "VenueDiscount_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueDiscount" ADD CONSTRAINT "VenueDiscount_code_check" CHECK (code = upper(code));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueDiscount" ADD CONSTRAINT "VenueDiscount_value_check" CHECK (num_nonnulls(percent, amount) = 1 AND (percent IS NULL OR percent BETWEEN 1 AND 100) AND (amount IS NULL OR amount > 0));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueDiscount" ADD CONSTRAINT "VenueDiscount_uses_check" CHECK ("maximumUses" IS NULL OR "maximumUses" > 0);
