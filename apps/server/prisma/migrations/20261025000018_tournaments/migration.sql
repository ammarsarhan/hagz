-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('KNOCKOUT', 'LEAGUE');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'OPEN', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentTeamStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WITHDRAWN', 'REJECTED');

-- CreateEnum
CREATE TYPE "TournamentMatchStatus" AS ENUM ('PENDING', 'PLAYED', 'WALKOVER');

-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('HOME', 'AWAY');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "venueId" UUID,
    "communityId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sport" "GroundSport" NOT NULL,
    "size" "GroundSize" NOT NULL,
    "format" "TournamentFormat" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "teamCap" SMALLINT NOT NULL,
    "joinRules" JSONB NOT NULL,
    "entryFee" INTEGER,
    "prizes" TEXT,
    "registrationClosesAt" TIMESTAMPTZ NOT NULL,
    "startsOn" DATE NOT NULL,
    "staffCreatorId" UUID,
    "customerCreatorId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTeam" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "captainId" UUID NOT NULL,
    "status" "TournamentTeamStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TournamentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPlayer" (
    "teamId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPlayer_pkey" PRIMARY KEY ("teamId","customerId")
);

-- CreateTable
CREATE TABLE "TournamentMatch" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "round" SMALLINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "homeTeamId" UUID,
    "awayTeamId" UUID,
    "nextMatchId" UUID,
    "nextSide" "MatchSide",
    "groundId" UUID,
    "startsAt" TIMESTAMPTZ,
    "status" "TournamentMatchStatus" NOT NULL DEFAULT 'PENDING',
    "homeScore" SMALLINT,
    "awayScore" SMALLINT,
    "scoreDetail" JSONB,
    "winnerTeamId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_code_key" ON "Tournament"("code");

-- CreateIndex
CREATE INDEX "Tournament_status_startsOn_idx" ON "Tournament"("status", "startsOn");

-- CreateIndex
CREATE INDEX "Tournament_venueId_idx" ON "Tournament"("venueId");

-- CreateIndex
CREATE INDEX "Tournament_communityId_idx" ON "Tournament"("communityId");

-- CreateIndex
CREATE INDEX "TournamentTeam_captainId_idx" ON "TournamentTeam"("captainId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_name_key" ON "TournamentTeam"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_id_tournamentId_key" ON "TournamentTeam"("id", "tournamentId");

-- CreateIndex
CREATE INDEX "TournamentPlayer_customerId_idx" ON "TournamentPlayer"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPlayer_tournamentId_customerId_key" ON "TournamentPlayer"("tournamentId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentMatch_tournamentId_round_position_key" ON "TournamentMatch"("tournamentId", "round", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentMatch_id_tournamentId_key" ON "TournamentMatch"("id", "tournamentId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_staffCreatorId_fkey" FOREIGN KEY ("staffCreatorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_customerCreatorId_fkey" FOREIGN KEY ("customerCreatorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_teamId_tournamentId_fkey" FOREIGN KEY ("teamId", "tournamentId") REFERENCES "TournamentTeam"("id", "tournamentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_homeTeamId_tournamentId_fkey" FOREIGN KEY ("homeTeamId", "tournamentId") REFERENCES "TournamentTeam"("id", "tournamentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_awayTeamId_tournamentId_fkey" FOREIGN KEY ("awayTeamId", "tournamentId") REFERENCES "TournamentTeam"("id", "tournamentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_winnerTeamId_tournamentId_fkey" FOREIGN KEY ("winnerTeamId", "tournamentId") REFERENCES "TournamentTeam"("id", "tournamentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_nextMatchId_tournamentId_fkey" FOREIGN KEY ("nextMatchId", "tournamentId") REFERENCES "TournamentMatch"("id", "tournamentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_groundId_fkey" FOREIGN KEY ("groundId") REFERENCES "Ground"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
-- A venue tournament is created by its staff, a community tournament by a member.
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizer_check" CHECK (
  ("venueId" IS NOT NULL AND "staffCreatorId" IS NOT NULL AND "communityId" IS NULL AND "customerCreatorId" IS NULL)
  OR ("communityId" IS NOT NULL AND "customerCreatorId" IS NOT NULL AND "venueId" IS NULL AND "staffCreatorId" IS NULL)
);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_terms_check" CHECK ("teamCap" >= 2 AND ("entryFee" IS NULL OR "entryFee" >= 0) AND jsonb_typeof("joinRules") = 'object');

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_position_check" CHECK ("round" >= 1 AND "position" >= 1 AND ("nextMatchId" IS NULL) = ("nextSide" IS NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_teams_check" CHECK ("homeTeamId" IS NULL OR "awayTeamId" IS NULL OR "homeTeamId" <> "awayTeamId");

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
-- Scores are the sport's main result (goals, points or sets won); the detail only follows a result.
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_score_check" CHECK (
  (status = 'PLAYED') = ("homeScore" IS NOT NULL AND "awayScore" IS NOT NULL)
  AND num_nonnulls("homeScore", "awayScore") IN (0, 2)
  AND "homeScore" >= 0 AND "awayScore" >= 0
  AND ("scoreDetail" IS NULL OR status = 'PLAYED')
);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
-- In every sport the higher main result wins; equal results are a draw or settled by the detail.
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_winner_check" CHECK (
  ("winnerTeamId" IS NULL OR "winnerTeamId" IN ("homeTeamId", "awayTeamId"))
  AND (status <> 'PLAYED' OR "homeScore" = "awayScore"
    OR "winnerTeamId" IS NOT DISTINCT FROM CASE WHEN "homeScore" > "awayScore" THEN "homeTeamId" ELSE "awayTeamId" END)
  AND (status <> 'WALKOVER' OR "winnerTeamId" IS NOT NULL)
  AND (status <> 'PENDING' OR "winnerTeamId" IS NULL)
);
