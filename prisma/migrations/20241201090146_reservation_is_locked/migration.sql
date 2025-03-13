/*
  Warnings:

  - You are about to drop the column `locked` on the `Reservation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "locked",
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT true;
