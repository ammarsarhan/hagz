/*
  Warnings:

  - Added the required column `location` to the `Owner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secondaryPhone` to the `Owner` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Owner" ADD COLUMN     "location" JSONB NOT NULL,
ADD COLUMN     "secondaryPhone" TEXT NOT NULL;
