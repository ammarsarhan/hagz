/*
  Warnings:

  - Added the required column `price` to the `Pitch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `Pitch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `surface` to the `Pitch` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PitchPolicy" AS ENUM ('DEFAULT', 'EXTENDED', 'SHORT');

-- CreateEnum
CREATE TYPE "PitchSize" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE');

-- CreateEnum
CREATE TYPE "PitchSurface" AS ENUM ('GRASS', 'ARTIFICIAL');

-- CreateEnum
CREATE TYPE "Amenity" AS ENUM ('INDOORS', 'BALL_PROVIDED', 'SEATING', 'NIGHT_LIGHTS', 'PARKING', 'SHOWERS', 'CHANGING_ROOMS', 'CAFETERIA', 'FIRST_AID', 'SECURITY');

-- AlterTable
ALTER TABLE "Pitch" ADD COLUMN     "amenities" "Amenity"[],
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "maximumSession" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "minimumSession" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "policy" "PitchPolicy" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "size" "PitchSize" NOT NULL,
ADD COLUMN     "status" "PitchStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "surface" "PitchSurface" NOT NULL;
