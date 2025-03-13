/*
  Warnings:

  - You are about to drop the column `recurringOptions` on the `Reservation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[startDate]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[endDate]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "recurringOptions",
ADD COLUMN     "recurringDates" TIMESTAMP(3)[],
ADD COLUMN     "reserveeEmail" TEXT,
ADD COLUMN     "reserveeName" TEXT NOT NULL DEFAULT 'Guest',
ADD COLUMN     "reserveePhone" TEXT NOT NULL DEFAULT '0000000000';

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_startDate_key" ON "Reservation"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_endDate_key" ON "Reservation"("endDate");
