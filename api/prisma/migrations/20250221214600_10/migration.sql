/*
  Warnings:

  - Made the column `search` on table `Pitch` required. This step will fail if there are existing NULL values in that column.

*/

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "userId" TEXT,
    "reserveeName" TEXT NOT NULL,
    "reserveePhone" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
