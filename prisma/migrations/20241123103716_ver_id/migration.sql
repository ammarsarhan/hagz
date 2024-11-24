/*
  Warnings:

  - You are about to drop the column `verificationToken` on the `Owner` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Owner" DROP COLUMN "verificationToken",
ADD COLUMN     "verificationId" TEXT;
