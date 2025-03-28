/*
  Warnings:

  - You are about to drop the column `endTime` on the `Pitch` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Pitch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pitch" DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "openFrom" TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN     "openTo" TEXT NOT NULL DEFAULT '23:59';
