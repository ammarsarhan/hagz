-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'WALLET', 'REFERENCE', 'BNPL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" INTEGER NOT NULL,
    "brand" TEXT,
    "provider" TEXT,
    "providerReference" TEXT,
    "providerFee" INTEGER,
    "recorderId" UUID,
    "succeededAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "amount" INTEGER NOT NULL,
    "providerReference" TEXT,
    "reason" TEXT,
    "recorderId" UUID,
    "succeededAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerReference_key" ON "Payment"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_paymentId_providerReference_key" ON "Refund"("paymentId", "providerReference");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recorderId_fkey" FOREIGN KEY ("recorderId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_recorderId_fkey" FOREIGN KEY ("recorderId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK (amount > 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_method_check" CHECK (((method = 'CASH') = (provider IS NULL)) AND (method <> 'CASH' OR ("providerReference" IS NULL AND brand IS NULL)));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_succeeded_check" CHECK ((status = 'SUCCEEDED') = ("succeededAt" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cash_check" CHECK (method <> 'CASH' OR (status = 'SUCCEEDED' AND "recorderId" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_check" CHECK (amount > 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_succeeded_check" CHECK ((status = 'SUCCEEDED') = ("succeededAt" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fee_check" CHECK ("providerFee" >= 0);
