/*
  Warnings:

  - Added the required column `endDate` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Error');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "ReservationStatus" NOT NULL;
