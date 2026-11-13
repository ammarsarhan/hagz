import type {
  CheckTaxNumber,
  RejectVenue,
  Rejection,
  ReviewVenue,
  VenueHistoryEvent,
  VenueHistoryQuery,
  VenueSetup,
  VenueTranslationInput,
} from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import type { Language, VenueStatus } from "@/generated/prisma/enums";
import { notifyAdmins, notifyStaff } from "@/modules/notifications";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import {
  LIFECYCLE_EVENTS,
  TAX_NUMBER_CHECKED,
  VENUE_APPROVED,
  VENUE_LIVE,
  VENUE_PAUSED,
  VENUE_REJECTED,
  VENUE_RESUMED,
  VENUE_SUBMITTED,
  VENUE_WITHDRAWN,
} from "../domain/events";
import { goLiveGaps } from "../domain/review";
import { venueNotFound, venueStatusConflict, type VenueAccess } from "./access";
import { adminVenueSelect, presentAdminVenue } from "./admin-venues";
import { writeTranslation } from "./venue-edit";
import { venueSetup } from "./venue-setup";

// A venue's review and going live (PR 2.7, docs/onboarding.md step 3). Every step locks the venue
// row, checks the status it starts from, and records a VenueEvent; notifications are written in the
// same transaction.

type Actor = { staffId: string } | { adminId: string };

const ownerOnly = () =>
  new AppError({
    code: "OWNER_ONLY",
    status: 403,
    detail: "Only the venue's owner can do this.",
  });

const setupIncomplete = (missing: string[]) =>
  new AppError({
    code: "SETUP_INCOMPLETE",
    status: 422,
    detail: "Some required setup items aren't done yet.",
    extensions: { missing },
  });

const goLiveBlocked = (missing: string[]) =>
  new AppError({
    code: "GO_LIVE_BLOCKED",
    status: 422,
    detail: "The venue needs Arabic and English listings and an active ground to go live.",
    extensions: { missing },
  });

const noActiveGround = () =>
  new AppError({
    code: "NO_ACTIVE_GROUND",
    status: 409,
    detail: "Resume a ground, or add one, before reopening the venue.",
  });

const lock = async (tx: Tx, venueId: string) => {
  const [venue] = await tx.$queryRaw<{ status: VenueStatus }[]>`
    SELECT status FROM "Venue" WHERE id = ${venueId}::uuid FOR UPDATE`;
  if (!venue) throw venueNotFound();
  return venue.status;
};

const statusTo = (detail: string) => (status: VenueStatus) => venueStatusConflict(status, detail);

const move = async (
  tx: Tx,
  venueId: string,
  from: VenueStatus[],
  to: VenueStatus,
  conflict: (status: VenueStatus) => AppError,
) => {
  const status = await lock(tx, venueId);
  if (!from.includes(status)) throw conflict(status);
  await tx.venue.update({ where: { id: venueId }, data: { status: to } });
};

const record = (
  tx: Tx,
  venueId: string,
  actor: Actor,
  type: string,
  data: Prisma.InputJsonValue = {},
) => tx.venueEvent.create({ data: { venueId, ...actor, type, data } });

const ownerOf = async (tx: Tx, venueId: string) =>
  (
    await tx.venueMembership.findFirst({
      where: { venueId, role: "OWNER" },
      select: { staffId: true },
    })
  )?.staffId;

const activeGrounds = (tx: Tx, venueId: string) =>
  tx.ground.count({ where: { venueId, status: "ACTIVE" } });

// ---------- The owner ----------

export const submitVenue = async (actor: VenueAccess, language: Language): Promise<VenueSetup> => {
  if (actor.role !== "OWNER") throw ownerOnly();
  await transaction(async (tx) => {
    const status = await lock(tx, actor.venueId);
    if (status !== "DRAFT")
      throw venueStatusConflict(status, "Only a draft can be sent for review.");
    // Edits lock the same row, so nothing changes between this check and the submission.
    const setup = await venueSetup(actor.venueId, language);
    if (!setup.canSubmit) {
      throw setupIncomplete(
        setup.items
          .filter((item) => item.required && item.state !== "DONE")
          .map((item) => item.key),
      );
    }
    await tx.venue.update({ where: { id: actor.venueId }, data: { status: "SUBMITTED" } });
    await record(tx, actor.venueId, { staffId: actor.staffId }, VENUE_SUBMITTED);
    const admins = await tx.admin.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    await notifyAdmins(
      tx,
      admins.map((admin) => ({
        adminId: admin.id,
        venueId: actor.venueId,
        type: "VENUE_SUBMITTED" as const,
        data: { submittedBy: actor.staffId },
      })),
    );
  });
  return venueSetup(actor.venueId, language);
};

export const withdrawVenue = async (actor: VenueAccess, language: Language) => {
  if (actor.role !== "OWNER") throw ownerOnly();
  await transaction(async (tx) => {
    await move(
      tx,
      actor.venueId,
      ["SUBMITTED"],
      "DRAFT",
      statusTo("Only a venue in review can be withdrawn."),
    );
    await record(tx, actor.venueId, { staffId: actor.staffId }, VENUE_WITHDRAWN);
  });
  return venueSetup(actor.venueId, language);
};

// Pausing hides a live venue from new bookings (existing ones stand); the owner's team or an admin
// can pause and resume.
export const pauseVenue = async (venueId: string, actor: Actor) => {
  await transaction(async (tx) => {
    await move(tx, venueId, ["LIVE"], "MAINTENANCE", statusTo("Only a live venue can be paused."));
    await record(tx, venueId, actor, VENUE_PAUSED);
  });
};

export const resumeVenue = async (venueId: string, actor: Actor) => {
  await transaction(async (tx) => {
    await move(
      tx,
      venueId,
      ["MAINTENANCE"],
      "LIVE",
      statusTo("Only a paused venue can be resumed."),
    );
    if ((await activeGrounds(tx, venueId)) === 0) throw noActiveGround();
    await record(tx, venueId, actor, VENUE_RESUMED);
  });
};

// The draft's latest rejection, while it's the newest step of its review.
export const rejectionOf = async (venueId: string): Promise<Rejection | null> => {
  const latest = await prisma.venueEvent.findFirst({
    where: { venueId, type: { in: LIFECYCLE_EVENTS } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { type: true, data: true, createdAt: true },
  });
  if (latest?.type !== VENUE_REJECTED) return null;
  return {
    reason: (latest.data as { reason?: string } | null)?.reason ?? "",
    at: latest.createdAt.toISOString(),
  };
};

// ---------- Admins ----------

export const reviewQueue = async (): Promise<ReviewVenue[]> => {
  const venues = await prisma.venue.findMany({
    where: { status: "SUBMITTED" },
    select: {
      ...adminVenueSelect,
      events: {
        where: { type: VENUE_SUBMITTED },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  return venues
    .map((venue) => ({
      ...presentAdminVenue(venue),
      submittedAt: (venue.events[0]?.createdAt ?? venue.createdAt).toISOString(),
    }))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
};

const tellOwner = async (
  tx: Tx,
  venueId: string,
  notification:
    | { type: "VENUE_APPROVED"; data: Record<string, never> }
    | { type: "VENUE_REJECTED"; data: { reason: string } }
    | { type: "VENUE_LIVE"; data: Record<string, never> },
  clock: Clock,
) => {
  const owner = await ownerOf(tx, venueId);
  if (owner) await notifyStaff(tx, [{ staffId: owner, venueId, ...notification }], clock);
};

export const approveVenue = async (
  adminId: string,
  venueId: string,
  clock: Clock = systemClock,
) => {
  await transaction(async (tx) => {
    await move(
      tx,
      venueId,
      ["SUBMITTED"],
      "PROVISIONING",
      statusTo("Only a venue in review can be approved."),
    );
    await record(tx, venueId, { adminId }, VENUE_APPROVED);
    await tellOwner(tx, venueId, { type: "VENUE_APPROVED", data: {} }, clock);
  });
};

export const rejectVenue = async (
  adminId: string,
  venueId: string,
  { reason }: RejectVenue,
  clock: Clock = systemClock,
) => {
  await transaction(async (tx) => {
    // Back to a draft: it stays the owner's one unfinished venue, so nothing else to check.
    await move(
      tx,
      venueId,
      ["SUBMITTED"],
      "DRAFT",
      statusTo("Only a venue in review can be rejected."),
    );
    await record(tx, venueId, { adminId }, VENUE_REJECTED, { reason });
    await tellOwner(tx, venueId, { type: "VENUE_REJECTED", data: { reason } }, clock);
  });
};

// Provisioning: Hagz completes the listing in both languages.
export const provisionTranslation = async (
  adminId: string,
  venueId: string,
  language: Language,
  input: VenueTranslationInput,
) => {
  await transaction(async (tx) => {
    const status = await lock(tx, venueId);
    if (!["PROVISIONING", "LIVE", "MAINTENANCE"].includes(status)) {
      throw venueStatusConflict(status, "Translations are added once the venue is approved.");
    }
    await writeTranslation(tx, venueId, language, input, { adminId });
  });
};

export const checkTaxNumber = async (adminId: string, venueId: string, input: CheckTaxNumber) => {
  await transaction(async (tx) => {
    const status = await lock(tx, venueId);
    if (status !== "PROVISIONING") {
      throw venueStatusConflict(status, "The tax number is checked while provisioning.");
    }
    const { taxNumber } = await tx.venue.findUniqueOrThrow({
      where: { id: venueId },
      select: { taxNumber: true },
    });
    await record(tx, venueId, { adminId }, TAX_NUMBER_CHECKED, { taxNumber, ...input });
  });
};

export const goLive = async (adminId: string, venueId: string, clock: Clock = systemClock) => {
  await transaction(async (tx) => {
    const status = await lock(tx, venueId);
    if (status !== "PROVISIONING") {
      throw venueStatusConflict(status, "Only a venue being provisioned can go live.");
    }
    const translations = await tx.venueTranslation.findMany({
      where: { venueId },
      select: { language: true, name: true, description: true, address: true },
    });
    const gaps = goLiveGaps(translations, await activeGrounds(tx, venueId));
    if (gaps.length > 0) throw goLiveBlocked(gaps);
    await tx.venue.update({ where: { id: venueId }, data: { status: "LIVE" } });
    await record(tx, venueId, { adminId }, VENUE_LIVE);
    await tellOwner(tx, venueId, { type: "VENUE_LIVE", data: {} }, clock);
  });
};

export const venueHistory = async (
  venueId: string,
  { cursor, limit }: VenueHistoryQuery,
): Promise<{ data: VenueHistoryEvent[]; next: string | null }> => {
  const exists = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  if (!exists) throw venueNotFound();
  const events = await prisma.venueEvent.findMany({
    where: { venueId, ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: { id: "desc" },
    take: limit + 1,
    select: {
      id: true,
      type: true,
      data: true,
      createdAt: true,
      staff: { select: { id: true, name: true } },
      admin: { select: { id: true, name: true } },
    },
  });
  const page = events.slice(0, limit);
  return {
    data: page.map((event) => ({
      id: event.id,
      type: event.type,
      actor: event.staff
        ? { kind: "STAFF" as const, ...event.staff }
        : event.admin
          ? { kind: "ADMIN" as const, ...event.admin }
          : { kind: "SYSTEM" as const, id: null, name: null },
      data: event.data,
      createdAt: event.createdAt.toISOString(),
    })),
    next: events.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
};
