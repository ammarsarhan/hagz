import {
  MANUAL_SLOT_MINUTES,
  type AddSlots,
  type ChangedSlots,
  type SetSlotPrice,
  type SlotSelection,
  type VenueSlots,
  type VenueSlotsQuery,
} from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { isExclusionViolation, violatedUniqueIndex } from "@/platform/db/errors";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import {
  SLOT_PRICES_SET,
  SLOTS_ADDED,
  SLOTS_BLOCKED,
  SLOTS_RESET,
  SLOTS_UNBLOCKED,
} from "../domain/events";
import { generationWindow } from "../domain/slots";
import type { VenueAccess } from "./access";
import { daySlots, presentSlot, slotSelect } from "./day-slots";
import { groundNotFound } from "./grounds";
import { enqueueGeneration } from "./slot-generation";
import { GONE_GROUNDS } from "../domain/grounds";

// Staff changing a venue's slots (PR 2.6), on top of what the weekly schedule generates: blocking
// and unblocking hours, pricing slots by hand, adding slots for an occasion (Eid, Ramadan, a match
// night), and resetting any of that to the schedule. A priced or added slot is the staff's
// (isManual): generation never re-prices or deletes it until it's reset. Only slots that haven't
// started can change, and each change is all or nothing. Every change is a VenueEvent.

const slotsNotFound = (slotIds: string[]) =>
  new AppError({
    code: "SLOT_NOT_FOUND",
    status: 404,
    detail: "Some of those slots aren't this venue's.",
    extensions: { slotIds },
  });

const slotsStarted = (slotIds: string[]) =>
  new AppError({
    code: "SLOT_STARTED",
    status: 422,
    detail: "Slots that have started can't change.",
    extensions: { slotIds },
  });

const slotsUnavailable = (slotIds: string[], detail: string) =>
  new AppError({ code: "SLOT_UNAVAILABLE", status: 409, detail, extensions: { slotIds } });

const invalidSlot = (index: number, detail: string) =>
  new AppError({ code: "INVALID_SLOT", status: 422, detail, extensions: { index } });

const slotsOverlap = () =>
  new AppError({
    code: "SLOT_OVERLAPS",
    status: 409,
    detail:
      "That time overlaps a slot that's held, booked, blocked or set by staff. Free or reset it first.",
  });

const record = (tx: Tx, actor: VenueAccess, type: string, data: Prisma.InputJsonValue) =>
  tx.venueEvent.create({ data: { venueId: actor.venueId, staffId: actor.staffId, type, data } });

export const staffDaySlots = (actor: VenueAccess, query: VenueSlotsQuery): Promise<VenueSlots> =>
  daySlots(actor.venueId, query);

// The venue's slots with these ids, locked, each one checked: there, and not started.
const lockSelected = async (tx: Tx, actor: VenueAccess, slotIds: string[], now: Date) => {
  const ids = [...new Set(slotIds)];
  await tx.$queryRaw`
    SELECT id FROM "GroundSlot"
    WHERE id = ANY(${ids}::uuid[]) AND "venueId" = ${actor.venueId}::uuid
    FOR UPDATE`;
  const slots = await tx.groundSlot.findMany({
    where: { id: { in: ids }, venueId: actor.venueId },
    select: slotSelect,
  });
  const found = new Set(slots.map((slot) => slot.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) throw slotsNotFound(missing);
  const started = slots.filter((slot) => slot.startsAt <= now).map((slot) => slot.id);
  if (started.length > 0) throw slotsStarted(started);
  return slots;
};

const reread = async (tx: Tx, ids: string[]): Promise<ChangedSlots> => ({
  slots: (
    await tx.groundSlot.findMany({
      where: { id: { in: ids } },
      orderBy: [{ startsAt: "asc" }, { groundId: "asc" }],
      select: slotSelect,
    })
  ).map(presentSlot),
});

// Closes free hours: nobody can book them until they're unblocked.
export const blockSlots = async (
  actor: VenueAccess,
  { slotIds }: SlotSelection,
  clock: Clock = systemClock,
): Promise<ChangedSlots> =>
  transaction(async (tx) => {
    const slots = await lockSelected(tx, actor, slotIds, clock.now());
    const taken = slots.filter((slot) => slot.status !== "AVAILABLE").map((slot) => slot.id);
    if (taken.length > 0) {
      throw slotsUnavailable(
        taken,
        "Only free slots can be blocked: these are held, booked or blocked.",
      );
    }
    const ids = slots.map((slot) => slot.id);
    await tx.groundSlot.updateMany({ where: { id: { in: ids } }, data: { status: "BLOCKED" } });
    await record(tx, actor, SLOTS_BLOCKED, { slotIds: ids });
    return reread(tx, ids);
  });

// Opens blocked hours again. One the schedule no longer has goes at the next generation run, unless
// staff set it.
export const unblockSlots = async (
  actor: VenueAccess,
  { slotIds }: SlotSelection,
  clock: Clock = systemClock,
): Promise<ChangedSlots> => {
  const { changed, groundIds } = await transaction(async (tx) => {
    const slots = await lockSelected(tx, actor, slotIds, clock.now());
    const open = slots.filter((slot) => slot.status !== "BLOCKED").map((slot) => slot.id);
    if (open.length > 0) throw slotsUnavailable(open, "Only blocked slots can be unblocked.");
    const ids = slots.map((slot) => slot.id);
    await tx.groundSlot.updateMany({ where: { id: { in: ids } }, data: { status: "AVAILABLE" } });
    await record(tx, actor, SLOTS_UNBLOCKED, { slotIds: ids });
    return {
      changed: await reread(tx, ids),
      groundIds: [...new Set(slots.map((slot) => slot.groundId))],
    };
  });
  await enqueueGeneration(groundIds);
  return changed;
};

// Prices slots by hand: they keep the price whatever the weekly schedule or tier prices become,
// until reset. A held or booked slot's booking already has its price; this one is for later ones.
export const setSlotPrice = async (
  actor: VenueAccess,
  { slotIds, price }: SetSlotPrice,
  clock: Clock = systemClock,
): Promise<ChangedSlots> =>
  transaction(async (tx) => {
    const slots = await lockSelected(tx, actor, slotIds, clock.now());
    const ids = slots.map((slot) => slot.id);
    // Price and the protection from re-pricing in one statement, so one is never without the other.
    await tx.groundSlot.updateMany({
      where: { id: { in: ids } },
      data: { price, isManual: true },
    });
    await record(tx, actor, SLOT_PRICES_SET, {
      slotIds: ids,
      price,
      previous: slots.map((slot) => ({ id: slot.id, price: slot.price, isManual: slot.isManual })),
    });
    return reread(tx, ids);
  });

// Adds slots for an occasion. Free generated slots they overlap make way (and generation won't put
// them back while the added slot is there); anything else in the way refuses the whole change.
export const addSlots = async (
  actor: VenueAccess,
  input: AddSlots,
  clock: Clock = systemClock,
): Promise<ChangedSlots> => {
  const now = clock.now();
  const { to: horizon } = generationWindow(now);
  const wanted = input.slots
    .map((slot, index) => ({
      index,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      tier: slot.tier,
      price: slot.price,
    }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const [i, slot] of wanted.entries()) {
    const minutes = (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000;
    const quarter = (date: Date) => date.getTime() % (15 * 60_000) === 0;
    if (slot.startsAt <= now) throw invalidSlot(slot.index, "It has to start in the future.");
    if (slot.startsAt >= horizon) {
      throw invalidSlot(slot.index, "Slots go up to 90 days ahead.");
    }
    if (minutes < MANUAL_SLOT_MINUTES.min || minutes > MANUAL_SLOT_MINUTES.max) {
      throw invalidSlot(slot.index, "A slot is from 30 minutes to 4 hours long.");
    }
    if (!quarter(slot.startsAt) || !quarter(slot.endsAt)) {
      throw invalidSlot(slot.index, "Slots start and end on the quarter hour.");
    }
    const before = wanted[i - 1];
    if (before && before.endsAt > slot.startsAt) {
      throw invalidSlot(slot.index, "It overlaps another slot being added.");
    }
  }

  try {
    return await transaction(async (tx) => {
      const ground = await tx.ground.findFirst({
        where: { id: input.groundId, venueId: actor.venueId, status: { notIn: [...GONE_GROUNDS] } },
        select: { id: true, settings: { select: { scheduleVersion: true } } },
      });
      if (!ground) throw groundNotFound();
      // Free generated slots in the way.
      await tx.$executeRaw`
        DELETE FROM "GroundSlot" AS g
        USING unnest(${wanted.map((s) => s.startsAt)}::timestamptz[],
                     ${wanted.map((s) => s.endsAt)}::timestamptz[]) AS n(s, e)
        WHERE g."groundId" = ${ground.id}::uuid AND g."status" = 'AVAILABLE' AND NOT g."isManual"
          AND tstzrange(g."startsAt", g."endsAt") && tstzrange(n.s, n.e)`;
      const created = await tx.groundSlot.createManyAndReturn({
        data: wanted.map((slot) => ({
          groundId: ground.id,
          venueId: actor.venueId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          tier: slot.tier,
          price: slot.price,
          isManual: true,
          scheduleVersion: ground.settings?.scheduleVersion ?? 0,
        })),
        select: { id: true },
      });
      const ids = created.map((slot) => slot.id);
      await record(tx, actor, SLOTS_ADDED, { groundId: ground.id, slotIds: ids });
      return reread(tx, ids);
    });
  } catch (error) {
    // The same hour, or an overlapping one, that isn't free generated.
    if (
      isExclusionViolation(error) ||
      violatedUniqueIndex(error) === "GroundSlot_groundId_startsAt_key"
    ) {
      throw slotsOverlap();
    }
    throw error;
  }
};

// Hands slots back to the schedule: prices by hand and added slots stop being the staff's, so the
// next run re-prices them from their tier, or removes the free ones the schedule doesn't have.
// Blocked slots stay blocked; unblock them for that.
export const resetSlots = async (
  actor: VenueAccess,
  { slotIds }: SlotSelection,
  clock: Clock = systemClock,
): Promise<ChangedSlots> => {
  const { changed, groundIds } = await transaction(async (tx) => {
    const slots = await lockSelected(tx, actor, slotIds, clock.now());
    const ids = slots.map((slot) => slot.id);
    await tx.groundSlot.updateMany({ where: { id: { in: ids } }, data: { isManual: false } });
    await record(tx, actor, SLOTS_RESET, { slotIds: ids });
    return {
      changed: await reread(tx, ids),
      groundIds: [...new Set(slots.map((slot) => slot.groundId))],
    };
  });
  await enqueueGeneration(groundIds);
  return changed;
};
