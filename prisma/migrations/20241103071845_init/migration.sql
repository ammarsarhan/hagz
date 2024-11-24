-- CreateEnum
CREATE TYPE "PitchSizeType" AS ENUM ('Five', 'Seven', 'Eleven');

-- CreateEnum
CREATE TYPE "GroundType" AS ENUM ('SG', 'AG', 'FG', 'TF');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('Cash', 'Card', 'Wallet');

-- CreateEnum
CREATE TYPE "PreferencesType" AS ENUM ('Email', 'SMS', 'Phone');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('Inactive', 'Verified', 'Suspended', 'Error');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Pending', 'Done', 'Cancelled', 'Error');

-- CreateEnum
CREATE TYPE "Amenity" AS ENUM ('Indoors', 'BallProvided', 'Seating', 'NightLights', 'Parking', 'Showers', 'ChangingRooms', 'Cafeteria', 'FirstAid', 'Security');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "groundType" "GroundType" NOT NULL,
    "pitchSize" "PitchSizeType" NOT NULL,
    "images" TEXT[],
    "location" JSONB NOT NULL,
    "rating" INTEGER NOT NULL,
    "amenities" "Amenity"[],
    "activePricingPlan" JSONB NOT NULL,
    "pricingPlans" JSONB[],
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "profilePicture" TEXT,
    "activePaymentMethod" JSONB NOT NULL,
    "paymentMethods" JSONB[],
    "location" JSONB NOT NULL,
    "preferences" "PreferencesType" NOT NULL,
    "phoneStatus" "ActionStatus" NOT NULL,
    "emailStatus" "ActionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
