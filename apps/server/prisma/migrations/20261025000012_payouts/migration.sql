-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_ACCOUNT', 'WALLET', 'INSTAPAY');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('COLLECTION', 'REFUND', 'COMMISSION', 'PAYOUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "PayoutDestination" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "holderName" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "destinationId" UUID NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "creatorId" UUID,
    "paidAt" TIMESTAMPTZ,
    "idempotencyKey" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "bookingId" UUID,
    "paymentId" UUID,
    "refundId" UUID,
    "payoutId" UUID,
    "adminId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutDestination_active_key" ON "PayoutDestination"("venueId") WHERE ("archivedAt" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutDestination_id_venueId_key" ON "PayoutDestination"("id", "venueId");

-- CreateIndex
CREATE INDEX "Payout_venueId_createdAt_idx" ON "Payout"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_id_venueId_key" ON "Payout"("id", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_paymentId_key" ON "LedgerEntry"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_refundId_key" ON "LedgerEntry"("refundId");

-- CreateIndex
CREATE INDEX "LedgerEntry_venueId_createdAt_idx" ON "LedgerEntry"("venueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_commission_key" ON "LedgerEntry"("bookingId") WHERE ("type" = 'COMMISSION');

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_payoutId_venueId_key" ON "LedgerEntry"("payoutId", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_venueId_idempotencyKey_key" ON "Payout"("venueId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PayoutDestination" ADD CONSTRAINT "PayoutDestination_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_destinationId_venueId_fkey" FOREIGN KEY ("destinationId", "venueId") REFERENCES "PayoutDestination"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bookingId_venueId_fkey" FOREIGN KEY ("bookingId", "venueId") REFERENCES "Booking"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_payoutId_venueId_fkey" FOREIGN KEY ("payoutId", "venueId") REFERENCES "Payout"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "PayoutDestination" ADD CONSTRAINT "PayoutDestination_bank_check" CHECK ((method = 'BANK_ACCOUNT') = ("bankName" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_amount_check" CHECK (amount > 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paid_check" CHECK ((status = 'PAID') = ("paidAt" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_kind_check" CHECK (
  num_nonnulls("bookingId", "paymentId", "refundId", "payoutId", "adminId") = 1 AND (
    (type = 'COLLECTION' AND "paymentId" IS NOT NULL AND amount > 0)
    OR (type = 'REFUND' AND "refundId" IS NOT NULL AND amount < 0)
    OR (type = 'COMMISSION' AND "bookingId" IS NOT NULL AND amount < 0)
    OR (type = 'PAYOUT' AND "payoutId" IS NOT NULL AND amount < 0)
    OR (type = 'ADJUSTMENT' AND "adminId" IS NOT NULL AND note IS NOT NULL AND amount <> 0)
  )
);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tax_check" CHECK ((type = 'COMMISSION' AND "taxAmount" BETWEEN amount AND 0) OR (type <> 'COMMISSION' AND "taxAmount" = 0));
