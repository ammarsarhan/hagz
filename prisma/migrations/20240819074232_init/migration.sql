-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'owner');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('pending', 'inSession', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "Size" AS ENUM ('three', 'five', 'seven', 'eleven');

-- CreateEnum
CREATE TYPE "Amenties" AS ENUM ('ball');

-- CreateTable
CREATE TABLE "Pitch" (
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "images" TEXT[],
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "ownerId" TEXT NOT NULL,
    "size" "Size" NOT NULL,
    "amenities" "Amenties"[],

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "uid" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "reserverId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "qrCode" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'pending',
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "User" (
    "uid" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',

    CONSTRAINT "User_pkey" PRIMARY KEY ("uid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_qrCode_key" ON "Reservation"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_reserverId_fkey" FOREIGN KEY ("reserverId") REFERENCES "User"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;
