CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coordinates" geometry(Point, 4326) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_idx" ON "Pitch" USING GIST ("coordinates");

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
