-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PROVISIONING', 'LIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "VenueRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "AmenityPricing" AS ENUM ('PER_HOUR', 'PER_BOOKING');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('MANUAL', 'DEPOSIT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT', 'CUSTOM');

-- CreateTable
CREATE TABLE "Venue" (
    "id" UUID NOT NULL,
    "marketplaceId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "VenueStatus" NOT NULL DEFAULT 'DRAFT',
    "placeId" TEXT,
    "phone" TEXT,
    "taxNumber" TEXT,
    "commissionRate" INTEGER,
    "coordinates" geography(Point, 4326),
    "averageRating" DECIMAL(3,2),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueTranslation" (
    "venueId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "VenueTranslation_pkey" PRIMARY KEY ("venueId","language")
);

-- CreateTable
CREATE TABLE "VenueMembership" (
    "venueId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "role" "VenueRole" NOT NULL DEFAULT 'MEMBER',
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueMembership_pkey" PRIMARY KEY ("venueId","staffId")
);

-- CreateTable
CREATE TABLE "VenueInvitation" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "invitorId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "acceptedAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueSettings" (
    "venueId" UUID NOT NULL,
    "defaultPermissions" JSONB NOT NULL,
    "minimumNotice" INTEGER NOT NULL DEFAULT 60,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT true,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'MANUAL',
    "depositPercent" INTEGER,
    "paymentWindow" INTEGER,
    "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'MODERATE',
    "cancellationTiers" JSONB,
    "loyaltyStamps" INTEGER,
    "loyaltyWindow" INTEGER,
    "regularHorizon" INTEGER NOT NULL DEFAULT 4,
    "confirmationWindow" INTEGER NOT NULL DEFAULT 24,
    "reminderLead" INTEGER NOT NULL DEFAULT 24,
    "freedDiscountHours" INTEGER,
    "lapsedAfter" INTEGER NOT NULL DEFAULT 3,
    "regularBookings" INTEGER NOT NULL DEFAULT 3,
    "regularPeriod" INTEGER NOT NULL DEFAULT 8,
    "fillAlertHours" INTEGER NOT NULL DEFAULT 6,
    "fillAlertOnRelease" BOOLEAN NOT NULL DEFAULT true,
    "fillAlertNearStart" BOOLEAN NOT NULL DEFAULT true,
    "fillAlertDigest" BOOLEAN NOT NULL DEFAULT true,
    "staffHoldMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueSettings_pkey" PRIMARY KEY ("venueId")
);

-- CreateTable
CREATE TABLE "VenueAmenity" (
    "venueId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "marketplaceId" UUID NOT NULL,
    "price" INTEGER,
    "pricing" "AmenityPricing",

    CONSTRAINT "VenueAmenity_pkey" PRIMARY KEY ("venueId","optionId")
);

-- CreateTable
CREATE TABLE "VenueMedia" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "contentType" TEXT NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueEvent" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "staffId" UUID,
    "adminId" UUID,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueFavorite" (
    "customerId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueFavorite_pkey" PRIMARY KEY ("customerId","venueId")
);

-- CreateTable
CREATE TABLE "VenueCustomer" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "customerId" UUID,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "lastBookedAt" TIMESTAMPTZ,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueReview" (
    "customerId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "language" "Language",
    "hiddenAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VenueReview_pkey" PRIMARY KEY ("customerId","venueId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_coordinates_idx" ON "Venue" USING GIST ("coordinates");

-- CreateIndex
CREATE INDEX "Venue_locationId_idx" ON "Venue"("locationId");

-- CreateIndex
CREATE INDEX "Venue_marketplaceId_status_idx" ON "Venue"("marketplaceId", "status");

-- CreateIndex
CREATE INDEX "Venue_marketplaceId_averageRating_idx" ON "Venue"("marketplaceId", "averageRating");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_id_marketplaceId_key" ON "Venue"("id", "marketplaceId");

-- CreateIndex
CREATE INDEX "VenueTranslation_language_name_idx" ON "VenueTranslation"("language", "name");

-- CreateIndex
CREATE INDEX "VenueMembership_staffId_idx" ON "VenueMembership"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueMembership_owner_key" ON "VenueMembership"("venueId") WHERE ("role" = 'OWNER');

-- CreateIndex
CREATE UNIQUE INDEX "VenueInvitation_codeHash_key" ON "VenueInvitation"("codeHash");

-- CreateIndex
CREATE INDEX "VenueInvitation_phone_idx" ON "VenueInvitation"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "VenueInvitation_open_key" ON "VenueInvitation"("venueId", "phone") WHERE ("acceptedAt" IS NULL AND "revokedAt" IS NULL);

-- CreateIndex
CREATE INDEX "VenueAmenity_optionId_idx" ON "VenueAmenity"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueMedia_key_key" ON "VenueMedia"("key");

-- CreateIndex
CREATE INDEX "VenueMedia_venueId_position_idx" ON "VenueMedia"("venueId", "position");

-- CreateIndex
CREATE INDEX "VenueEvent_venueId_createdAt_idx" ON "VenueEvent"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "VenueEvent_venueId_type_idx" ON "VenueEvent"("venueId", "type");

-- CreateIndex
CREATE INDEX "VenueFavorite_venueId_idx" ON "VenueFavorite"("venueId");

-- CreateIndex
CREATE INDEX "VenueCustomer_customerId_idx" ON "VenueCustomer"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueCustomer_venueId_customerId_key" ON "VenueCustomer"("venueId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueCustomer_venueId_phone_key" ON "VenueCustomer"("venueId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "VenueCustomer_id_venueId_key" ON "VenueCustomer"("id", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueReview_bookingId_key" ON "VenueReview"("bookingId");

-- CreateIndex
CREATE INDEX "VenueReview_venueId_createdAt_idx" ON "VenueReview"("venueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VenueReview_bookingId_customerId_key" ON "VenueReview"("bookingId", "customerId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_locationId_marketplaceId_fkey" FOREIGN KEY ("locationId", "marketplaceId") REFERENCES "Location"("id", "marketplaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueTranslation" ADD CONSTRAINT "VenueTranslation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueMembership" ADD CONSTRAINT "VenueMembership_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueMembership" ADD CONSTRAINT "VenueMembership_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueInvitation" ADD CONSTRAINT "VenueInvitation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueInvitation" ADD CONSTRAINT "VenueInvitation_invitorId_fkey" FOREIGN KEY ("invitorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueSettings" ADD CONSTRAINT "VenueSettings_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAmenity" ADD CONSTRAINT "VenueAmenity_venueId_marketplaceId_fkey" FOREIGN KEY ("venueId", "marketplaceId") REFERENCES "Venue"("id", "marketplaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAmenity" ADD CONSTRAINT "VenueAmenity_optionId_marketplaceId_fkey" FOREIGN KEY ("optionId", "marketplaceId") REFERENCES "AmenityOption"("id", "marketplaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueMedia" ADD CONSTRAINT "VenueMedia_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueEvent" ADD CONSTRAINT "VenueEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueEvent" ADD CONSTRAINT "VenueEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueEvent" ADD CONSTRAINT "VenueEvent_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueFavorite" ADD CONSTRAINT "VenueFavorite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueFavorite" ADD CONSTRAINT "VenueFavorite_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueCustomer" ADD CONSTRAINT "VenueCustomer_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueCustomer" ADD CONSTRAINT "VenueCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReview" ADD CONSTRAINT "VenueReview_customerId_venueId_fkey" FOREIGN KEY ("customerId", "venueId") REFERENCES "VenueCustomer"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueEvent" ADD CONSTRAINT "VenueEvent_one_actor_check"
  CHECK (num_nonnulls("staffId", "adminId") = 1);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueReview" ADD CONSTRAINT "VenueReview_rating_check"
  CHECK (rating BETWEEN 1 AND 5);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueSettings" ADD CONSTRAINT "VenueSettings_deposit_check" CHECK ((("paymentMode" = 'DEPOSIT') = ("depositPercent" IS NOT NULL)) AND ("depositPercent" IS NULL OR "depositPercent" BETWEEN 1 AND 99));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueSettings" ADD CONSTRAINT "VenueSettings_window_check" CHECK ("paymentWindow" > 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_commission_check" CHECK ("commissionRate" BETWEEN 0 AND 10000);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueSettings" ADD CONSTRAINT "VenueSettings_cancellation_check" CHECK ((("cancellationPolicy" = 'CUSTOM') = ("cancellationTiers" IS NOT NULL)) AND ("cancellationTiers" IS NULL OR jsonb_typeof("cancellationTiers") = 'array'));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueSettings" ADD CONSTRAINT "VenueSettings_loyalty_check" CHECK ((("loyaltyStamps" IS NULL) = ("loyaltyWindow" IS NULL)) AND ("loyaltyStamps" IS NULL OR ("loyaltyStamps" >= 2 AND "loyaltyWindow" > 0)));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueSettings" ADD CONSTRAINT "VenueSettings_regulars_check" CHECK ("regularHorizon" BETWEEN 1 AND 12 AND "confirmationWindow" BETWEEN 1 AND 168 AND "reminderLead" BETWEEN 1 AND 168 AND ("freedDiscountHours" IS NULL OR "freedDiscountHours" BETWEEN 1 AND 48));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueSettings" ADD CONSTRAINT "VenueSettings_fill_check" CHECK ("lapsedAfter" BETWEEN 1 AND 12 AND "regularBookings" >= 1 AND "regularPeriod" BETWEEN 1 AND 26 AND "fillAlertHours" BETWEEN 1 AND 72 AND "staffHoldMinutes" BETWEEN 5 AND 60);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "VenueCustomer" ADD CONSTRAINT "VenueCustomer_counts_check" CHECK ("bookingCount" >= 0 AND "noShowCount" >= 0);
