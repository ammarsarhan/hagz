-- CreateTable
CREATE TABLE "AmenityOption" (
    "id" UUID NOT NULL,
    "marketplaceId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AmenityOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmenityTranslation" (
    "optionId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AmenityTranslation_pkey" PRIMARY KEY ("optionId","language")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmenityOption_marketplaceId_key_key" ON "AmenityOption"("marketplaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AmenityOption_id_marketplaceId_key" ON "AmenityOption"("id", "marketplaceId");

-- AddForeignKey
ALTER TABLE "AmenityOption" ADD CONSTRAINT "AmenityOption_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityTranslation" ADD CONSTRAINT "AmenityTranslation_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AmenityOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
