/*
  Warnings:

  - The `accountStatus` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('UNVERIFIED', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT NOT NULL,
DROP COLUMN "accountStatus",
ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- DropEnum
DROP TYPE "UserAccountStatus";

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "company" TEXT,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_phone_key" ON "Owner"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
