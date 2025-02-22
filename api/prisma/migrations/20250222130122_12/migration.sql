/*
  Warnings:

  - Made the column `search` on table `Pitch` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'MANUAL', 'PAID', 'REFUNDED');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING';
