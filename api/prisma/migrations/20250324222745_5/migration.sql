/*
  Warnings:

  - You are about to drop the column `size` on the `Pitch` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Pitch` table. All the data in the column will be lost.
  - You are about to drop the column `surface` on the `Pitch` table. All the data in the column will be lost.
  - You are about to drop the column `pitchId` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `verificationToken` on the `Reservation` table. All the data in the column will be lost.
  - Added the required column `voidDate` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `Pitch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groundId` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GroundStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'CLOSED');

-- CreateEnum
CREATE TYPE "GroundSize" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE');

-- CreateEnum
CREATE TYPE "GroundSurface" AS ENUM ('NATURAL', 'ARTIFICIAL');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'MANUAL';

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_pitchId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voidDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Pitch" DROP COLUMN "size",
DROP COLUMN "status",
DROP COLUMN "surface",
ADD COLUMN     "location" JSONB NOT NULL,
ALTER COLUMN "maximumSession" SET DEFAULT 6;

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "pitchId",
DROP COLUMN "verificationToken",
ADD COLUMN     "groundId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "PitchSize";

-- DropEnum
DROP TYPE "PitchStatus";

-- DropEnum
DROP TYPE "PitchSurface";

-- CreateTable
CREATE TABLE "Ground" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "index" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "images" TEXT[],
    "size" "GroundSize" NOT NULL,
    "surface" "GroundSurface" NOT NULL,
    "status" "GroundStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Ground_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Ground" ADD CONSTRAINT "Ground_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_groundId_fkey" FOREIGN KEY ("groundId") REFERENCES "Ground"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
