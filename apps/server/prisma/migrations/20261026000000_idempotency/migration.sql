-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "idempotencyKey" UUID;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "idempotencyKey" UUID;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "idempotencyKey" UUID;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "idempotencyKey" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_venueId_idempotencyKey_key" ON "Booking"("venueId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_idempotencyKey_key" ON "Payment"("bookingId", "idempotencyKey");

-- DropIndex (after its replacement exists, so bookingId lookups always have an index)
DROP INDEX "Payment_bookingId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Payout_venueId_idempotencyKey_key" ON "Payout"("venueId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_paymentId_idempotencyKey_key" ON "Refund"("paymentId", "idempotencyKey");
