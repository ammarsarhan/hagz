-- CreateEnum
CREATE TYPE "LayoutItemType" AS ENUM ('GROUND', 'CAFE', 'TOILETS', 'CHANGING_ROOMS', 'PARKING', 'SEATING');

-- CreateEnum
CREATE TYPE "GroundOrientation" AS ENUM ('HORIZONTAL', 'VERTICAL');

-- CreateTable
CREATE TABLE "VenueLayout" (
    "venueId" UUID NOT NULL,
    "columns" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "entrances" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueLayout_pkey" PRIMARY KEY ("venueId")
);

-- CreateTable
CREATE TABLE "VenueLayoutItem" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "type" "LayoutItemType" NOT NULL,
    "groundId" UUID,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "orientation" "GroundOrientation",
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueLayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueLayoutItem_venueId_idx" ON "VenueLayoutItem"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueLayoutItem_groundId_venueId_key" ON "VenueLayoutItem"("groundId", "venueId");

-- AddForeignKey
ALTER TABLE "VenueLayout" ADD CONSTRAINT "VenueLayout_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueLayoutItem" ADD CONSTRAINT "VenueLayoutItem_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "VenueLayout"("venueId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueLayoutItem" ADD CONSTRAINT "VenueLayoutItem_groundId_venueId_fkey" FOREIGN KEY ("groundId", "venueId") REFERENCES "Ground"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueLayout" ADD CONSTRAINT "VenueLayout_size_check"
  CHECK (columns BETWEEN 1 AND 60 AND rows BETWEEN 1 AND 60);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueLayoutItem" ADD CONSTRAINT "VenueLayoutItem_position_check"
  CHECK (x >= 0 AND y >= 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueLayoutItem" ADD CONSTRAINT "VenueLayoutItem_kind_check"
  CHECK (
    (type = 'GROUND' AND "groundId" IS NOT NULL AND orientation IS NOT NULL AND width IS NULL AND height IS NULL)
    OR (type <> 'GROUND' AND "groundId" IS NULL AND orientation IS NULL AND width IS NOT NULL AND height IS NOT NULL
        AND width BETWEEN 1 AND 4 AND height BETWEEN 1 AND 4)
  );
