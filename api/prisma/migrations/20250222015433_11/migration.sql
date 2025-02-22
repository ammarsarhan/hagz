/*
  Warnings:

  - Made the column `search` on table `Pitch` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdBy` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('USER', 'OWNER');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" "AccountType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
