-- AlterTable
ALTER TABLE "Pitch" ADD COLUMN     "endTime" TEXT NOT NULL DEFAULT '23:59',
ADD COLUMN     "startTime" TEXT NOT NULL DEFAULT '00:00';
