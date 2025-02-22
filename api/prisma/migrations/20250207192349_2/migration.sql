-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('UNVERIFIED', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'UNVERIFIED';
