/*
  Warnings:

  - You are about to drop the column `approvalExpiry` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `isApproved` on the `Reservation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Ground" ALTER COLUMN "index" DROP DEFAULT;
DROP SEQUENCE "Ground_index_seq";

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "approvalExpiry",
DROP COLUMN "isApproved";
