/*
  Warnings:

  - The `accountStatus` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `verificationToken` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('UNVERIFIED', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verificationToken" TEXT NOT NULL,
DROP COLUMN "accountStatus",
ADD COLUMN     "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- DropEnum
DROP TYPE "AccountStatus";
