/*
  Warnings:

  - Made the column `search` on table `Pitch` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('MANUAL', 'PENDING', 'PAID', 'REFUNDED');

-- DropIndex
DROP INDEX "search_idx";

-- AlterTable
ALTER TABLE "Pitch" ALTER COLUMN "search" SET NOT NULL,
ALTER COLUMN "search" DROP DEFAULT;

ALTER TABLE "Pitch" 
ADD COLUMN search tsvector GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;

CREATE INDEX search_idx ON "Pitch" USING GIN (search);

-- Rename existing index
ALTER INDEX "location_idx" RENAME TO "coordinates_idx";

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "reserveeName" TEXT NOT NULL,
    "reserveePhone" TEXT NOT NULL,
    "userId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
