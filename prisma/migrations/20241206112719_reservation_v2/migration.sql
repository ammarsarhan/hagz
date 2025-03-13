-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "additionalNotes" TEXT,
ADD COLUMN     "recurringOptions" JSONB;
