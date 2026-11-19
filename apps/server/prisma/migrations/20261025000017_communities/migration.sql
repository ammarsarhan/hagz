-- CreateEnum
CREATE TYPE "CommunityPolicy" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CommunityGamesBy" AS ENUM ('MEMBERS', 'ADMINS');

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "CommunityMemberStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'DECLINED', 'LEFT', 'REMOVED', 'BANNED');

-- CreateTable
CREATE TABLE "Community" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatarKey" TEXT,
    "sport" "GroundSport",
    "locationId" UUID NOT NULL,
    "policy" "CommunityPolicy" NOT NULL,
    "gamesBy" "CommunityGamesBy" NOT NULL DEFAULT 'MEMBERS',
    "notice" TEXT,
    "whatsappLink" TEXT,
    "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "communityId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "status" "CommunityMemberStatus" NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMPTZ,
    "joinedAt" TIMESTAMPTZ,
    "leftAt" TIMESTAMPTZ,
    "decidedAt" TIMESTAMPTZ,
    "deciderId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("communityId","customerId")
);

-- CreateTable
CREATE TABLE "CommunityInvite" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "creatorId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "CommunityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityEvent" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "customerId" UUID,
    "adminId" UUID,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "Community_status_locationId_idx" ON "Community"("status", "locationId");

-- CreateIndex
CREATE INDEX "CommunityMember_communityId_status_idx" ON "CommunityMember"("communityId", "status");

-- CreateIndex
CREATE INDEX "CommunityMember_customerId_idx" ON "CommunityMember"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_owner_key" ON "CommunityMember"("communityId") WHERE ("role" = 'OWNER');

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_codeHash_key" ON "CommunityInvite"("codeHash");

-- CreateIndex
CREATE INDEX "CommunityInvite_communityId_idx" ON "CommunityInvite"("communityId");

-- CreateIndex
CREATE INDEX "CommunityEvent_communityId_createdAt_idx" ON "CommunityEvent"("communityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingListing" ADD CONSTRAINT "BookingListing_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Community" ADD CONSTRAINT "Community_count_check" CHECK ("memberCount" >= 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
-- Only a Hagz admin hides a community, and always says why.
ALTER TABLE "Community" ADD CONSTRAINT "Community_hidden_check" CHECK ((status = 'HIDDEN') = ("hiddenReason" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Community" ADD CONSTRAINT "Community_whatsapp_check" CHECK ("whatsappLink" IS NULL OR "whatsappLink" LIKE 'https://chat.whatsapp.com/%');

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
-- The owner is always an active member, so the owner index means one owner who can't just leave.
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_owner_check" CHECK (role <> 'OWNER' OR status = 'ACTIVE');

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_status_check" CHECK (
  (status <> 'REQUESTED' OR "requestedAt" IS NOT NULL)
  AND (status <> 'ACTIVE' OR "joinedAt" IS NOT NULL)
  AND ((status = 'LEFT') = ("leftAt" IS NOT NULL))
  AND (status NOT IN ('DECLINED', 'REMOVED', 'BANNED') OR "deciderId" IS NOT NULL)
  AND (("decidedAt" IS NULL) = ("deciderId" IS NULL))
);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_uses_check" CHECK ("uses" >= 0 AND ("maxUses" IS NULL OR ("maxUses" >= 1 AND "uses" <= "maxUses")));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_one_actor_check" CHECK (num_nonnulls("customerId", "adminId") <= 1);
