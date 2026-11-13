import {
  MAXIMUM_GROUNDS,
  type CopySchedule,
  type CreateGround,
  type Ground,
  type ReorderGrounds,
  type UpdateGround,
  type WeekSchedule,
} from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import {
  GROUND_ADDED,
  GROUND_CHANGED,
  GROUND_REMOVED,
  GROUND_SCHEDULE_CHANGED,
  GROUND_SCHEDULE_COPIED,
  GROUNDS_REORDERED,
} from "../domain/events";
import {
  checkScheduleAgainstPrices,
  fromStoredHours,
  mergeGround,
  tiersIn,
  toStoredHours,
  type GroundFields,
} from "../domain/grounds";
import { nameIn } from "../domain/names";
import type { VenueAccess } from "./access";
import { lockForEdit } from "./venue-edit";
import { afterFootprintChange } from "./layout-hooks";

// A venue's grounds and their weekly hours (PR 2.4). Grounds are operations: editable while
// provisioning, locked in review. Deleting keeps the row (status DELETED) for booking history.

export const groundNotFound = () =>
  new AppError({ code: "GROUND_NOT_FOUND", status: 404, detail: "There's no such ground." });

const groundLimitReached = () =>
  new AppError({
    code: "GROUND_LIMIT_REACHED",
    status: 409,
    detail: `A venue can have up to ${MAXIMUM_GROUNDS} grounds.`,
  });

// A live venue always has an active ground (docs/onboarding.md, "A live venue always has a
// ground"); the venue row is locked before counting, so two pauses can't both pass.
const lastActiveGround = () =>
  new AppError({
    code: "LAST_ACTIVE_GROUND",
    status: 409,
    detail: "This is the venue's last active ground. Add another, or pause the venue first.",
  });

const invalidGroundOrder = () =>
  new AppError({
    code: "INVALID_GROUND_ORDER",
    status: 422,
    detail: "List every ground exactly once.",
  });

const select = {
  id: true,
  sport: true,
  size: true,
  surface: true,
  environment: true,
  status: true,
  position: true,
  basePrice: true,
  peakPrice: true,
  discountPrice: true,
  translations: { select: { language: true, name: true } },
  settings: { select: { minimumSlots: true, maximumSlots: true } },
  schedules: { select: { hours: true } },
} as const satisfies Prisma.GroundSelect;

type Row = Prisma.GroundGetPayload<{ select: typeof select }>;

const present = (row: Row, language: Language): Ground => ({
  id: row.id,
  name: nameIn(row.translations, language),
  sport: row.sport,
  size: row.size,
  surface: row.surface,
  environment: row.environment,
  status: row.status === "MAINTENANCE" ? "MAINTENANCE" : "ACTIVE",
  position: row.position,
  basePrice: row.basePrice,
  peakPrice: row.peakPrice,
  discountPrice: row.discountPrice,
  minimumSlots: row.settings?.minimumSlots ?? 1,
  maximumSlots: row.settings?.maximumSlots ?? 3,
  openHours: row.schedules.reduce(
    (sum, day) => sum + Object.keys((day.hours ?? {}) as object).length,
    0,
  ),
});

export const listGrounds = async (venueId: string, language: Language): Promise<Ground[]> => {
  const rows = await prisma.ground.findMany({
    where: { venueId, status: { not: "DELETED" } },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select,
  });
  return rows.map((row) => present(row, language));
};

const findGround = async (tx: Tx, venueId: string, groundId: string) => {
  const ground = await tx.ground.findFirst({
    where: { id: groundId, venueId, status: { not: "DELETED" } },
    select,
  });
  if (!ground) throw groundNotFound();
  return ground;
};

const staffLanguage = async (tx: Tx, staffId: string) =>
  (await tx.staff.findUniqueOrThrow({ where: { id: staffId }, select: { language: true } }))
    .language;

const event = (tx: Tx, actor: VenueAccess, type: string, data: Prisma.InputJsonValue) =>
  tx.venueEvent.create({ data: { venueId: actor.venueId, staffId: actor.staffId, type, data } });

const bumpSchedule = (tx: Tx, groundId: string) =>
  tx.groundSettings.update({
    where: { groundId },
    data: { scheduleVersion: { increment: 1 } },
  });

export const createGround = async (
  actor: VenueAccess,
  input: CreateGround,
  language: Language,
): Promise<Ground> => {
  const id = await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const count = await tx.ground.count({
      where: { venueId: actor.venueId, status: { not: "DELETED" } },
    });
    if (count >= MAXIMUM_GROUNDS) throw groundLimitReached();
    const last = await tx.ground.findFirst({
      where: { venueId: actor.venueId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const { name, minimumSlots, maximumSlots, ...fields } = input;
    const ground = await tx.ground.create({
      data: {
        venueId: actor.venueId,
        ...fields,
        position: last ? last.position + 1 : 0,
        translations: { create: { language: await staffLanguage(tx, actor.staffId), name } },
        settings: { create: { minimumSlots, maximumSlots } },
      },
      select: { id: true },
    });
    await event(tx, actor, GROUND_ADDED, { groundId: ground.id, ...input });
    return ground.id;
  });
  const created = await prisma.ground.findUniqueOrThrow({ where: { id }, select });
  return present(created, language);
};

const fieldsOf = (row: Row): GroundFields => ({
  sport: row.sport,
  size: row.size,
  surface: row.surface,
  environment: row.environment,
  basePrice: row.basePrice,
  peakPrice: row.peakPrice,
  discountPrice: row.discountPrice,
  minimumSlots: row.settings?.minimumSlots ?? 1,
  maximumSlots: row.settings?.maximumSlots ?? 3,
});

const refuseLastActive = async (tx: Tx, venueId: string, groundId: string) => {
  const venue = await tx.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: { status: true },
  });
  if (venue.status !== "LIVE") return;
  const others = await tx.ground.count({
    where: { venueId, status: "ACTIVE", id: { not: groundId } },
  });
  if (others === 0) throw lastActiveGround();
};

export const updateGround = async (
  actor: VenueAccess,
  groundId: string,
  change: UpdateGround,
  language: Language,
): Promise<Ground> => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const row = await findGround(tx, actor.venueId, groundId);
    const { name, status, ...fieldChange } = change;
    const previous = fieldsOf(row);
    const used = tiersIn(row.schedules.map((day, i) => fromStoredHours(i, day.hours)));
    const next = mergeGround(previous, fieldChange, used);

    const changes: Record<string, { previous: unknown; next: unknown }> = {};
    for (const key of Object.keys(next) as (keyof GroundFields)[]) {
      if (previous[key] !== next[key]) changes[key] = { previous: previous[key], next: next[key] };
    }

    if (status !== undefined && status !== row.status) {
      if (status === "MAINTENANCE") await refuseLastActive(tx, actor.venueId, groundId);
      changes.status = { previous: row.status, next: status };
    }

    if (name !== undefined) {
      const editorLanguage = await staffLanguage(tx, actor.staffId);
      const current = row.translations.find((t) => t.language === editorLanguage)?.name ?? null;
      if (current !== name) {
        await tx.groundTranslation.upsert({
          where: { groundId_language: { groundId, language: editorLanguage } },
          create: { groundId, language: editorLanguage, name },
          update: { name },
        });
        changes.name = { previous: current, next: name };
      }
    }
    if (Object.keys(changes).length === 0) return;

    const { minimumSlots, maximumSlots, ...groundFields } = next;
    await tx.ground.update({
      where: { id: groundId },
      data: { ...groundFields, ...(status === undefined ? {} : { status }) },
    });
    await tx.groundSettings.upsert({
      where: { groundId },
      create: { groundId, minimumSlots, maximumSlots },
      update: { minimumSlots, maximumSlots },
    });
    // Prices and booking length shape the slots, so generation picks the change up.
    const shapesSlots = ["basePrice", "peakPrice", "discountPrice", "minimumSlots", "maximumSlots"];
    if (shapesSlots.some((key) => key in changes)) await bumpSchedule(tx, groundId);
    if ("sport" in changes || "size" in changes) await afterFootprintChange(tx, groundId);
    await event(tx, actor, GROUND_CHANGED, { groundId, changes } as Prisma.InputJsonValue);
  });
  const updated = await prisma.ground.findUniqueOrThrow({ where: { id: groundId }, select });
  return present(updated, language);
};

export const removeGround = async (actor: VenueAccess, groundId: string) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const row = await findGround(tx, actor.venueId, groundId);
    if (row.status === "ACTIVE") await refuseLastActive(tx, actor.venueId, groundId);
    await tx.ground.update({ where: { id: groundId }, data: { status: "DELETED" } });
    // A deleted ground leaves the layout (docs: layout rules).
    await tx.venueLayoutItem.deleteMany({ where: { groundId } });
    await event(tx, actor, GROUND_REMOVED, { groundId });
  });
};

export const reorderGrounds = async (
  actor: VenueAccess,
  input: ReorderGrounds,
  language: Language,
) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const current = (
      await tx.ground.findMany({
        where: { venueId: actor.venueId, status: { not: "DELETED" } },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true },
      })
    ).map((ground) => ground.id);
    const wanted = input.groundIds;
    if (
      wanted.length !== current.length ||
      new Set(wanted).size !== wanted.length ||
      !wanted.every((id) => current.includes(id))
    ) {
      throw invalidGroundOrder();
    }
    if (wanted.every((id, i) => id === current[i])) return;
    for (const [position, id] of wanted.entries()) {
      await tx.ground.update({ where: { id }, data: { position } });
    }
    await event(tx, actor, GROUNDS_REORDERED, { previous: current, next: wanted });
  });
  return listGrounds(actor.venueId, language);
};

// ---------- Weekly hours ----------

export const groundSchedule = async (venueId: string, groundId: string): Promise<WeekSchedule> => {
  const ground = await prisma.ground.findFirst({
    where: { id: groundId, venueId, status: { not: "DELETED" } },
    select: {
      schedules: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, hours: true } },
    },
  });
  if (!ground) throw groundNotFound();
  return { days: ground.schedules.map((day) => fromStoredHours(day.dayOfWeek, day.hours)) };
};

const writeSchedule = async (tx: Tx, groundId: string, week: WeekSchedule) => {
  await tx.groundSchedule.deleteMany({ where: { groundId } });
  const open = week.days.filter((day) => day.hours.length > 0);
  if (open.length > 0) {
    await tx.groundSchedule.createMany({
      data: open.map((day) => ({ groundId, dayOfWeek: day.dayOfWeek, hours: toStoredHours(day) })),
    });
  }
  await bumpSchedule(tx, groundId);
};

export const putSchedule = async (actor: VenueAccess, groundId: string, week: WeekSchedule) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const ground = await findGround(tx, actor.venueId, groundId);
    checkScheduleAgainstPrices(week.days, ground);
    const previous = ground.schedules.length;
    await writeSchedule(tx, groundId, week);
    await event(tx, actor, GROUND_SCHEDULE_CHANGED, {
      groundId,
      previousOpenDays: previous,
      next: week,
    });
  });
  return groundSchedule(actor.venueId, groundId);
};

// Copies the hours and their tiers; each ground keeps its own prices, so each must have the prices
// the copied tiers need.
export const copySchedule = async (actor: VenueAccess, groundId: string, input: CopySchedule) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const source = await findGround(tx, actor.venueId, groundId);
    const days = await tx.groundSchedule.findMany({
      where: { groundId: source.id },
      select: { dayOfWeek: true, hours: true },
    });
    const week: WeekSchedule = {
      days: days.map((day) => fromStoredHours(day.dayOfWeek, day.hours)),
    };
    const targets = [...new Set(input.groundIds)].filter((id) => id !== groundId);
    for (const targetId of targets) {
      const target = await findGround(tx, actor.venueId, targetId);
      try {
        checkScheduleAgainstPrices(week.days, target);
      } catch (error) {
        if (error instanceof AppError) error.extensions.groundId = targetId;
        throw error;
      }
      await writeSchedule(tx, targetId, week);
    }
    await event(tx, actor, GROUND_SCHEDULE_COPIED, { from: groundId, to: targets });
  });
};
