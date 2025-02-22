/*
  Warnings:

  - The `amenities` column on the `Pitch` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PitchAmenity" AS ENUM ('INDOORS', 'BALL_PROVIDED', 'SEATING', 'NIGHT_LIGHTS', 'PARKING', 'SHOWERS', 'CHANGING_ROOMS', 'CAFETERIA', 'FIRST_AID', 'SECURITY');

-- AlterTable
ALTER TABLE "Pitch" DROP COLUMN "amenities",
ADD COLUMN     "amenities" "PitchAmenity"[];

-- DropEnum
DROP TYPE "Amenity";
