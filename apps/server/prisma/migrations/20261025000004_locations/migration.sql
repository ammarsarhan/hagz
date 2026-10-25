-- CreateEnum
CREATE TYPE "Locality" AS ENUM ('REGION', 'EMIRATE', 'GOVERNORATE', 'MUNICIPALITY', 'WILAYAT', 'CITY', 'DISTRICT', 'AREA', 'NEIGHBORHOOD');

-- CreateTable
CREATE TABLE "Marketplace" (
    "id" UUID NOT NULL,
    "code" CHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "dialCode" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "taxRate" INTEGER NOT NULL DEFAULT 0,
    "commissionRate" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceTranslation" (
    "marketplaceId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MarketplaceTranslation_pkey" PRIMARY KEY ("marketplaceId","language")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "marketplaceId" UUID NOT NULL,
    "parentId" UUID,
    "locality" "Locality" NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationTranslation" (
    "language" "Language" NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "LocationTranslation_pkey" PRIMARY KEY ("locationId","language")
);

-- CreateIndex
CREATE UNIQUE INDEX "Marketplace_code_key" ON "Marketplace"("code");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE INDEX "Location_marketplaceId_locality_idx" ON "Location"("marketplaceId", "locality");

-- CreateIndex
CREATE UNIQUE INDEX "Location_id_marketplaceId_key" ON "Location"("id", "marketplaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_root_slug_key" ON "Location"("marketplaceId", "slug") WHERE ("parentId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Location_child_slug_key" ON "Location"("parentId", "slug") WHERE ("parentId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "LocationTranslation_language_name_idx" ON "LocationTranslation"("language", "name");

-- AddForeignKey
ALTER TABLE "MarketplaceTranslation" ADD CONSTRAINT "MarketplaceTranslation_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_marketplaceId_fkey" FOREIGN KEY ("parentId", "marketplaceId") REFERENCES "Location"("id", "marketplaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTranslation" ADD CONSTRAINT "LocationTranslation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Marketplace" ADD CONSTRAINT "Marketplace_tax_check" CHECK ("taxRate" BETWEEN 0 AND 10000);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Marketplace" ADD CONSTRAINT "Marketplace_commission_check" CHECK ("commissionRate" BETWEEN 0 AND 10000);
