CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('USER', 'OWNER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('UNVERIFIED', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PitchPolicy" AS ENUM ('DEFAULT', 'EXTENDED', 'SHORT');

-- CreateEnum
CREATE TYPE "PitchSize" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE');

-- CreateEnum
CREATE TYPE "PitchSurface" AS ENUM ('GRASS', 'ARTIFICIAL');

-- CreateEnum
CREATE TYPE "PitchAmenity" AS ENUM ('INDOORS', 'BALL_PROVIDED', 'SEATING', 'NIGHT_LIGHTS', 'PARKING', 'SHOWERS', 'CHANGING_ROOMS', 'CAFETERIA', 'FIRST_AID', 'SECURITY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verificationToken" TEXT,
    "phone" TEXT NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coordinates" geometry NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "images" TEXT[],
    "maximumSession" INTEGER NOT NULL DEFAULT 3,
    "minimumSession" INTEGER NOT NULL DEFAULT 1,
    "policy" "PitchPolicy" NOT NULL DEFAULT 'DEFAULT',
    "price" DOUBLE PRECISION NOT NULL,
    "size" "PitchSize" NOT NULL,
    "status" "PitchStatus" NOT NULL DEFAULT 'ACTIVE',
    "surface" "PitchSurface" NOT NULL,
    "amenities" "PitchAmenity"[],
    "search" tsvector GENERATED ALWAYS AS (to_tsvector('english', "name")) STORED,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "userId" TEXT,
    "reserveeName" TEXT NOT NULL,
    "reserveePhone" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "verificationToken" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" "AccountType" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_phone_key" ON "Owner"("phone");

-- CreateIndex
CREATE INDEX "coordinates_idx" ON "Pitch" USING GIST ("coordinates");

-- CreateIndex
CREATE INDEX "search_idx" ON "Pitch" USING GIN ("search");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
