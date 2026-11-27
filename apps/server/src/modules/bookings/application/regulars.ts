import type {
  BookingSettings,
  CancellationTier,
  CreateRegular,
  OrderRegulars,
  RegularStatus,
  UpdateRegular,
  VenueRegular,
  VenueRegularDetail,
  VenueRegularList,
} from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import {
  assignSlots,
  instantOf,
  lockFreeSlots,
  releaseSlots,
  resolvedTiers,
  type VenueAccess,
} from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { priceBooking } from "../domain/charges";
import { BOOKING_EVENTS } from "../domain/events";
import {
  isoDate,
  localToday,
  reliabilityOf,
  comingWeeksOf,
  lastWeeksOf,
  upcomingWeeks,
  weekOf,
  type ReservationOutcome,
  type Week,
} from "../domain/regulars";
import { checkLength, coversExactly } from "../domain/rules";
import { LIVE_STATUSES } from "../domain/status";
import { groundName } from "./admin-bookings";
import { newCode, withFreshCode } from "./booking-rows";
import { targetGround } from "./rescheduling";
import { customerFor, normalized } from "./staff-entry";
import { presentStaff, staffSelect } from "./staff-bookings";

// Regulars (PR 4.5, docs/regulars.md). Staff set one up for a venue customer; Hagz keeps an
// UNCONFIRMED reservation for every week up to VenueSettings.regularHorizon, each confirmed or
// released before its deadline (confirmationWindow hours before kick-off). Reservations are paid at
// the venue with no commission. A week whose time is taken or closed is skipped and tried again
// every day. Overlapping regulars are allowed: the lower priority reserves a week first, and a week
// already reserved stays with its regular (user, 2026-11-22).

const regularNotFound = () =>
  new AppError({ code: "REGULAR_NOT_FOUND", status: 404, detail: "There's no such regular here." });

const regularEnded = () =>
  new AppError({ code: "REGULAR_ENDED", status: 409, detail: "This regular has ended." });

const venueClosed = (venueStatus: string) =>
  new AppError({
    code: "VENUE_STATUS_CONFLICT",
    status: 409,
    detail: "Regulars can be set up once the venue is live.",
    extensions: { venueStatus },
  });

const badDates = (detail: string) =>
  new AppError({ code: "INVALID_REGULAR_DATES", status: 422, detail });

const notOverlapping = () =>
  new AppError({
    code: "REGULARS_NOT_FOUND",
    status: 404,
    detail: "Some of these regulars aren't at this venue.",
  });

// The venue's terms for reservations, or null when it isn't taking bookings.
const termsOf = async (db: Tx | typeof prisma, venueId: string) => {
  const venue = await db.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: {
      status: true,
      taxNumber: true,
      marketplace: { select: { taxRate: true, timezone: true } },
      settings: {
        select: {
          regularHorizon: true,
          confirmationWindow: true,
          cancellationPolicy: true,
          cancellationTiers: true,
        },
      },
    },
  });
  const settings = venue.settings;
  const tiers =
    settings &&
    resolvedTiers(
      settings.cancellationPolicy,
      settings.cancellationTiers as CancellationTier[] | null,
    );
  const live = venue.status === "LIVE" || venue.status === "MAINTENANCE";
  return {
    status: venue.status,
    open: live && settings?.cancellationPolicy != null && tiers != null,
    timezone: venue.marketplace.timezone,
    taxRate: venue.taxNumber ? venue.marketplace.taxRate : 0,
    horizonWeeks: settings?.regularHorizon ?? 4,
    confirmationHours: settings?.confirmationWindow ?? 24,
    policy: settings?.cancellationPolicy ?? null,
    tiers: tiers ?? null,
  };
};

type Terms = Awaited<ReturnType<typeof termsOf>>;

const weeksOf = (regular: Parameters<typeof upcomingWeeks>[0], terms: Terms, now: Date): Week[] =>
  upcomingWeeks(regular, {
    now,
    timezone: terms.timezone,
    horizonWeeks: terms.horizonWeeks,
    confirmationHours: terms.confirmationHours,
    instantOf,
  });

const regularSelect = {
  id: true,
  venueId: true,
  groundId: true,
  customerId: true,
  creatorId: true,
  dayOfWeek: true,
  startHour: true,
  slotCount: true,
  startsOn: true,
  endsOn: true,
  pausedAt: true,
  endedAt: true,
  priority: true,
  createdAt: true,
} as const satisfies Prisma.VenueRegularSelect;

type RegularRow = Prisma.VenueRegularGetPayload<{ select: typeof regularSelect }>;

const statusOf = (regular: RegularRow, today: Date): RegularStatus => {
  if (regular.endedAt || (regular.endsOn && regular.endsOn < today)) return "ENDED";
  return regular.pausedAt ? "PAUSED" : "ACTIVE";
};

// A week the regular has a row for blocks reserving it again, unless the row was released because
// the regular itself was changed or paused. So does a calendar week it already has a live game in at
// another time: one it confirmed before its time changed, or one moved to another day or hour. A
// regular plays once a week (user, 2026-11-26).
const WEEK_MS = 7 * 86_400_000;

const blockingWeeks = async (
  tx: Tx,
  regularId: string,
  weeks: readonly Week[],
  timezone: string,
) => {
  if (weeks.length === 0) return new Set<number>();
  const first = Math.min(...weeks.map((week) => week.startsAt.getTime()));
  const last = Math.max(...weeks.map((week) => week.startsAt.getTime()));
  const [rows, live] = await Promise.all([
    tx.booking.findMany({
      where: { regularId, startsAt: { in: weeks.map((week) => week.startsAt) } },
      select: {
        startsAt: true,
        status: true,
        events: { where: { type: BOOKING_EVENTS.REGULAR_CHANGED }, select: { id: true }, take: 1 },
      },
    }),
    tx.booking.findMany({
      where: {
        regularId,
        status: { in: [...LIVE_STATUSES] },
        startsAt: { gte: new Date(first - WEEK_MS), lte: new Date(last + WEEK_MS) },
      },
      select: { startsAt: true },
    }),
  ]);
  const taken = new Set(live.map((row) => weekOf(localToday(row.startsAt, timezone))));
  return new Set([
    ...rows
      .filter((row) => !(row.status === "RELEASED" && row.events.length > 0))
      .map((row) => row.startsAt.getTime()),
    ...weeks
      .filter((week) => taken.has(weekOf(new Date(`${week.date}T00:00:00Z`))))
      .map((week) => week.startsAt.getTime()),
  ]);
};

// Reserves every week the venue's active regulars are missing, in priority order. One transaction
// per venue under an advisory lock, so two top-ups never race and priority holds. Returns the weeks
// each regular had to skip.
export const topUpVenue = async (
  venueId: string,
  clock: Clock = systemClock,
): Promise<Map<string, string[]>> =>
  withFreshCode(() =>
    transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`regulars:${venueId}`}, 0))`;
      const now = clock.now();
      const skipped = new Map<string, string[]>();
      const terms = await termsOf(tx, venueId);
      if (!terms.open || !terms.policy || !terms.tiers) return skipped;
      const today = localToday(now, terms.timezone);
      // A regular whose ground is gone for good (its last booking ended) ends with it; one whose
      // ground is being removed keeps the weeks it has and gets no more (user, 2026-11-27).
      await tx.venueRegular.updateMany({
        where: { venueId, endedAt: null, ground: { status: "DELETED" } },
        data: { endedAt: now },
      });
      const regulars = await tx.venueRegular.findMany({
        where: {
          venueId,
          pausedAt: null,
          endedAt: null,
          OR: [{ endsOn: null }, { endsOn: { gte: today } }],
          ground: { status: { not: "REMOVING" } },
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: regularSelect,
      });
      for (const regular of regulars) {
        const weeks = weeksOf(regular, terms, now);
        const blocked = await blockingWeeks(tx, regular.id, weeks, terms.timezone);
        const missed: string[] = [];
        for (const week of weeks) {
          if (blocked.has(week.startsAt.getTime())) continue;
          // The customer's own booking at exactly this time (a staff hold, or one confirmed) is
          // this week of theirs: it joins the regular rather than the week being skipped as taken
          // (user, 2026-11-26). Its slots stay as they are: a hold's are HELD, as a reservation's.
          const own = await tx.booking.findFirst({
            where: {
              venueId,
              groundId: regular.groundId,
              customerId: regular.customerId,
              regularId: null,
              startsAt: week.startsAt,
              endsAt: week.endsAt,
              OR: [{ status: "CONFIRMED" }, { status: "HELD", creatorId: { not: null } }],
            },
            select: { id: true, status: true },
          });
          if (own) {
            await tx.booking.update({
              where: { id: own.id },
              data:
                own.status === "HELD"
                  ? { regularId: regular.id, status: "UNCONFIRMED", expiresAt: week.deadline }
                  : { regularId: regular.id },
            });
            await tx.bookingEvent.create({
              data: {
                bookingId: own.id,
                type: BOOKING_EVENTS.REGULAR_JOINED,
                data: { from: own.status },
              },
            });
            continue;
          }
          const slots = await lockFreeSlots(tx, regular.groundId, week.startsAt, week.endsAt);
          if (!coversExactly(slots, week.startsAt, week.endsAt)) {
            missed.push(week.date);
            continue;
          }
          const price = priceBooking(slots, [], terms.taxRate);
          const { id } = await tx.booking.create({
            data: {
              venueId,
              groundId: regular.groundId,
              customerId: regular.customerId,
              creatorId: regular.creatorId,
              regularId: regular.id,
              code: newCode(),
              status: "UNCONFIRMED",
              startsAt: week.startsAt,
              endsAt: week.endsAt,
              expiresAt: week.deadline,
              total: price.total,
              paymentMode: "MANUAL",
              commissionRate: 0,
              cancellationPolicy: terms.policy,
              cancellationTiers: terms.tiers,
              charges: {
                create: price.lines.map((line) => ({
                  type: line.type,
                  startsAt: line.startsAt,
                  tier: line.tier,
                  amount: line.amount,
                  taxRate: line.taxRate,
                  taxAmount: line.taxAmount,
                })),
              },
              events: {
                create: { type: BOOKING_EVENTS.CREATED, data: { status: "UNCONFIRMED" } },
              },
            },
            select: { id: true },
          });
          await assignSlots(
            tx,
            slots.map((slot) => slot.id),
            id,
            "HELD",
          );
        }
        if (missed.length > 0) skipped.set(regular.id, missed);
      }
      return skipped;
    }),
  );

// The daily run (docs/regulars.md "Topping up"): every venue with an active regular. Returns how many
// venues it went through.
export const topUpAllVenues = async (clock: Clock = systemClock): Promise<number> => {
  const venues = await prisma.venueRegular.findMany({
    where: { pausedAt: null, endedAt: null },
    distinct: ["venueId"],
    select: { venueId: true },
  });
  for (const { venueId } of venues) await topUpVenue(venueId, clock);
  return venues.length;
};

// Lets go of a regular's UNCONFIRMED reservations still to come (or those `keep` doesn't want) as
// REGULAR_CHANGED, which never counts against it.
export const releaseWeeks = async (
  tx: Tx,
  regularId: string,
  reason: "CHANGED" | "PAUSED" | "ENDED" | "REORDERED" | "HORIZON" | "GROUND_REMOVED",
  now: Date,
  keep: (startsAt: Date) => boolean = () => false,
) => {
  const rows = await tx.$queryRaw<{ id: string; startsAt: Date }[]>`
    SELECT id, "startsAt" FROM "Booking"
    WHERE "regularId" = ${regularId}::uuid AND status = 'UNCONFIRMED' AND "startsAt" > ${now}
    ORDER BY id
    FOR UPDATE`;
  const ids = rows.filter((row) => !keep(row.startsAt)).map((row) => row.id);
  if (ids.length === 0) return;
  await tx.booking.updateMany({ where: { id: { in: ids } }, data: { status: "RELEASED" } });
  await releaseSlots(tx, ids, now);
  await tx.bookingEvent.createMany({
    data: ids.map((bookingId) => ({
      bookingId,
      type: BOOKING_EVENTS.REGULAR_CHANGED,
      data: { reason },
    })),
  });
};

// A change to the venue's booking settings, carried on to the regulars' weeks already reserved
// (user, 2026-11-26; docs/regulars.md "Booking settings"):
// - A new confirmation window moves every waiting week's deadline to it, unless that has already
//   passed: a settings change never lets a week go, it keeps the deadline it had.
// - A shorter horizon lets go of the waiting weeks beyond it (not counted against anyone); the
//   confirmed ones stay, as the customer said yes to them.
// - Then the top-up: a longer horizon's new weeks, and weeks a shorter window brings back into
//   reach, are reserved straight away rather than at night.
// The hold length and who counts as a regular need nothing here: holds read it when made or
// extended, and Fill a slot when it's asked.
export const followBookingSettings = async (
  venueId: string,
  previous: BookingSettings,
  next: BookingSettings,
  clock: Clock = systemClock,
) => {
  const window = next.confirmationWindow !== previous.confirmationWindow;
  const shorter = next.regularHorizon < previous.regularHorizon;
  const longer = next.regularHorizon > previous.regularHorizon;
  if (!window && !shorter && !longer) return;
  await transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`regulars:${venueId}`}, 0))`;
    const now = clock.now();
    if (window) {
      await tx.$executeRaw`
        UPDATE "Booking"
        SET "expiresAt" = "startsAt" - make_interval(hours => ${next.confirmationWindow}::int)
        WHERE "venueId" = ${venueId}::uuid
          AND "regularId" IS NOT NULL
          AND status = 'UNCONFIRMED'
          AND "startsAt" - make_interval(hours => ${next.confirmationWindow}::int) > ${now}`;
    }
    if (shorter) {
      const terms = await termsOf(tx, venueId);
      const last = localToday(now, terms.timezone).getTime() + next.regularHorizon * 7 * DAY_MS;
      const waiting = await tx.booking.findMany({
        where: { venueId, regularId: { not: null }, status: "UNCONFIRMED", startsAt: { gt: now } },
        select: { regularId: true },
        distinct: ["regularId"],
      });
      for (const { regularId } of waiting) {
        if (!regularId) continue;
        await releaseWeeks(
          tx,
          regularId,
          "HORIZON",
          now,
          (startsAt) => localToday(startsAt, terms.timezone).getTime() <= last,
        );
      }
    }
  });
  await topUpVenue(venueId, clock);
};

const DAY_MS = 24 * 60 * 60 * 1000;

const lockRegular = async (tx: Tx, venueId: string, id: string) => {
  await tx.$queryRaw`SELECT id FROM "VenueRegular" WHERE id = ${id}::uuid FOR UPDATE`;
  const regular = await tx.venueRegular.findFirst({
    where: { id, venueId },
    select: regularSelect,
  });
  if (!regular) throw regularNotFound();
  return regular;
};

const outcomesOf = async (regularIds: readonly string[]) => {
  const rows = await prisma.booking.findMany({
    where: { regularId: { in: [...regularIds] } },
    select: {
      regularId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      events: {
        where: {
          type: {
            in: [BOOKING_EVENTS.CONFIRMED, BOOKING_EVENTS.RELEASED, BOOKING_EVENTS.REGULAR_CHANGED],
          },
        },
        select: { type: true, data: true },
      },
    },
  });
  const outcomes = new Map<string, (ReservationOutcome & { startsAt: Date; endsAt: Date })[]>();
  for (const row of rows) {
    if (!row.regularId) continue;
    const released = row.events.find(
      (event) =>
        event.type === BOOKING_EVENTS.RELEASED || event.type === BOOKING_EVENTS.REGULAR_CHANGED,
    );
    const by = (released?.data as { by?: string } | null)?.by;
    const outcome = {
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      confirmed: row.events.some((event) => event.type === BOOKING_EVENTS.CONFIRMED),
      releasedBy:
        released?.type === BOOKING_EVENTS.REGULAR_CHANGED
          ? "REGULAR"
          : by === "STAFF" || by === "CUSTOMER" || by === "DEADLINE"
            ? by
            : null,
    } satisfies ReservationOutcome & { startsAt: Date; endsAt: Date };
    outcomes.set(row.regularId, [...(outcomes.get(row.regularId) ?? []), outcome]);
  }
  return (regularId: string) => outcomes.get(regularId) ?? [];
};

const reliabilities = async (regularIds: readonly string[]) => {
  const outcomes = await outcomesOf(regularIds);
  return (regularId: string) => reliabilityOf(outcomes(regularId));
};

const listSelect = {
  ...regularSelect,
  customer: { select: { id: true, name: true, phone: true, customerId: true } },
  ground: {
    select: { id: true, status: true, translations: { select: { language: true, name: true } } },
  },
} as const satisfies Prisma.VenueRegularSelect;

type ListRow = Prisma.VenueRegularGetPayload<{ select: typeof listSelect }>;

const present = (
  row: ListRow,
  today: Date,
  reliability: (id: string) => VenueRegular["reliability"],
): VenueRegular => ({
  id: row.id,
  status: statusOf(row, today),
  customer: {
    id: row.customer.id,
    name: row.customer.name,
    phone: row.customer.phone,
    app: row.customer.customerId !== null,
  },
  ground: {
    id: row.ground.id,
    name: groundName(row.ground.translations),
    deleted: row.ground.status === "REMOVING" || row.ground.status === "DELETED",
  },
  dayOfWeek: row.dayOfWeek,
  startHour: row.startHour,
  slotCount: row.slotCount,
  startsOn: isoDate(row.startsOn),
  endsOn: row.endsOn ? isoDate(row.endsOn) : null,
  pausedAt: row.pausedAt?.toISOString() ?? null,
  priority: row.priority,
  reliability: reliability(row.id),
  createdAt: row.createdAt.toISOString(),
});

// The venue's regulars by weekday and hour, overlapping ones in priority order.
export const listRegulars = async (
  actor: VenueAccess,
  clock: Clock = systemClock,
): Promise<VenueRegularList> => {
  const terms = await termsOf(prisma, actor.venueId);
  const rows = await prisma.venueRegular.findMany({
    where: { venueId: actor.venueId },
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }, { priority: "asc" }],
    select: listSelect,
  });
  const reliability = await reliabilities(rows.map((row) => row.id));
  const today = localToday(clock.now(), terms.timezone);
  return { data: rows.map((row) => present(row, today, reliability)) };
};

export const regularDetail = async (
  actor: VenueAccess,
  id: string,
  clock: Clock = systemClock,
): Promise<VenueRegularDetail> => {
  const now = clock.now();
  const row = await prisma.venueRegular.findFirst({
    where: { id, venueId: actor.venueId },
    select: listSelect,
  });
  if (!row) throw regularNotFound();
  const terms = await termsOf(prisma, actor.venueId);
  const today = localToday(now, terms.timezone);
  const outcomes = await outcomesOf([row.id]);
  const regular = present(row, today, (one) => reliabilityOf(outcomes(one)));
  const reservations = await prisma.booking.findMany({
    where: { regularId: id, endsAt: { gt: now }, status: { in: [...LIVE_STATUSES] } },
    orderBy: { startsAt: "asc" },
    select: staffSelect,
  });
  let skippedWeeks: string[] = [];
  // A ground being removed takes no new weeks, so none are "skipped".
  if (regular.status === "ACTIVE" && row.ground.status !== "REMOVING") {
    const weeks = weeksOf(row, terms, now);
    const blocked = await transaction((tx) => blockingWeeks(tx, id, weeks, terms.timezone));
    skippedWeeks = weeks
      .filter((week) => !blocked.has(week.startsAt.getTime()))
      .map((week) => week.date);
  }
  return {
    ...regular,
    reservations: reservations.map((row) => presentStaff(row)),
    skippedWeeks,
    lastWeeks: lastWeeksOf(outcomes(row.id), now, terms.timezone),
    comingWeeks: comingWeeksOf(outcomes(row.id), now, terms.timezone),
  };
};

const checkDates = (startsOn: Date, endsOn: Date | null, today: Date) => {
  if (endsOn && endsOn < startsOn) throw badDates("The end date is before the start date.");
  if (endsOn && endsOn < today) throw badDates("The end date has passed.");
  return { startsOn, endsOn };
};

const asDate = (text: string) => new Date(`${text}T00:00:00Z`);

// The lock the top-up takes, taken first (before any row lock) wherever regulars are added or moved.
export const lockVenueRegulars = (tx: Tx, venueId: string) =>
  tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`regulars:${venueId}`}, 0))`;

const alreadyRegular = () =>
  new AppError({
    code: "REGULAR_OVERLAPS",
    status: 409,
    detail: "This customer already has a regular at this time on this ground.",
  });

// One customer, one regular at a time on a ground: none of their other regulars, paused ones too,
// may share an hour of it on the same weekday while both run (user, 2026-11-26). Other customers
// may: they wait in line behind. Callers hold the venue's regulars lock (lockVenueRegulars), so two
// at once can't both pass.
const checkNotTwice = async (
  tx: Tx,
  venueId: string,
  regular: {
    customerId: string;
    groundId: string;
    dayOfWeek: number;
    startHour: number;
    slotCount: number;
    startsOn: Date;
    endsOn: Date | null;
  },
  today: Date,
  exceptId: string | null = null,
) => {
  const from = regular.startsOn > today ? regular.startsOn : today;
  const others = await tx.venueRegular.findMany({
    where: {
      venueId,
      customerId: regular.customerId,
      groundId: regular.groundId,
      dayOfWeek: regular.dayOfWeek,
      endedAt: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
      AND: [
        { OR: [{ endsOn: null }, { endsOn: { gte: from } }] },
        ...(regular.endsOn ? [{ startsOn: { lte: regular.endsOn } }] : []),
      ],
    },
    select: { startHour: true, slotCount: true },
  });
  const overlaps = others.some(
    (other) =>
      other.startHour < regular.startHour + regular.slotCount &&
      regular.startHour < other.startHour + other.slotCount,
  );
  if (overlaps) throw alreadyRegular();
};

export const createRegular = async (
  actor: VenueAccess,
  body: CreateRegular,
  clock: Clock = systemClock,
): Promise<VenueRegularDetail> => {
  const now = clock.now();
  const terms = await termsOf(prisma, actor.venueId);
  if (!terms.open) throw venueClosed(terms.status);
  const today = localToday(now, terms.timezone);
  if (asDate(body.startsOn) < today) throw badDates("The start date has passed.");
  const dates = checkDates(asDate(body.startsOn), body.endsOn ? asDate(body.endsOn) : null, today);
  const customer = normalized(body.customer);
  const id = await transaction(async (tx) => {
    await lockVenueRegulars(tx, actor.venueId);
    const ground = await targetGround(tx, actor.venueId, body.groundId);
    checkLength(body.slotCount, ground.minimumSlots, ground.maximumSlots);
    const customerId = await customerFor(tx, actor.venueId, customer);
    await checkNotTwice(
      tx,
      actor.venueId,
      {
        customerId,
        groundId: ground.id,
        dayOfWeek: body.dayOfWeek,
        startHour: body.startHour,
        slotCount: body.slotCount,
        ...dates,
      },
      today,
    );
    const last = await tx.venueRegular.aggregate({
      where: { venueId: actor.venueId },
      _max: { priority: true },
    });
    const regular = await tx.venueRegular.create({
      data: {
        venueId: actor.venueId,
        groundId: ground.id,
        customerId,
        creatorId: actor.staffId,
        dayOfWeek: body.dayOfWeek,
        startHour: body.startHour,
        slotCount: body.slotCount,
        ...dates,
        priority: (last._max.priority ?? 0) + 1,
      },
      select: { id: true },
    });
    return regular.id;
  });
  await topUpVenue(actor.venueId, clock);
  return regularDetail(actor, id, clock);
};

// A new time, ground or length releases the unconfirmed weeks and reserves the new time; an earlier
// end date releases the unconfirmed weeks after it. Confirmed weeks stay either way.
export const updateRegular = async (
  actor: VenueAccess,
  id: string,
  body: UpdateRegular,
  clock: Clock = systemClock,
): Promise<VenueRegularDetail> => {
  const now = clock.now();
  const terms = await termsOf(prisma, actor.venueId);
  const today = localToday(now, terms.timezone);
  await transaction(async (tx) => {
    await lockVenueRegulars(tx, actor.venueId);
    const regular = await lockRegular(tx, actor.venueId, id);
    if (statusOf(regular, today) === "ENDED") throw regularEnded();
    const endsOn =
      body.endsOn === undefined ? regular.endsOn : body.endsOn ? asDate(body.endsOn) : null;
    checkDates(regular.startsOn, endsOn, today);
    const groundId = body.groundId ?? regular.groundId;
    const slotCount = body.slotCount ?? regular.slotCount;
    if (body.groundId !== undefined || body.slotCount !== undefined) {
      const ground = await targetGround(tx, actor.venueId, groundId);
      checkLength(slotCount, ground.minimumSlots, ground.maximumSlots);
    }
    const moved =
      groundId !== regular.groundId ||
      slotCount !== regular.slotCount ||
      (body.dayOfWeek ?? regular.dayOfWeek) !== regular.dayOfWeek ||
      (body.startHour ?? regular.startHour) !== regular.startHour;
    await checkNotTwice(
      tx,
      actor.venueId,
      {
        customerId: regular.customerId,
        groundId,
        dayOfWeek: body.dayOfWeek ?? regular.dayOfWeek,
        startHour: body.startHour ?? regular.startHour,
        slotCount,
        startsOn: regular.startsOn,
        endsOn,
      },
      today,
      regular.id,
    );
    if (moved) {
      await releaseWeeks(tx, regular.id, "CHANGED", now);
    } else if (endsOn) {
      await releaseWeeks(
        tx,
        regular.id,
        "CHANGED",
        now,
        (startsAt) => localToday(startsAt, terms.timezone) <= endsOn,
      );
    }
    await tx.venueRegular.update({
      where: { id: regular.id },
      data: {
        groundId,
        slotCount,
        dayOfWeek: body.dayOfWeek ?? regular.dayOfWeek,
        startHour: body.startHour ?? regular.startHour,
        endsOn,
      },
    });
  });
  await topUpVenue(actor.venueId, clock);
  return regularDetail(actor, id, clock);
};

// The regulars behind `regularId` in line at a time overlapping its own let their waiting weeks go,
// so the top-up after hands them out in priority order again (user, 2026-11-26: a regular back
// from a pause gets its weeks back from the one next in line). Confirmed weeks stay put.
const yieldWeeks = async (tx: Tx, regularId: string, now: Date) => {
  const self = await tx.venueRegular.findUniqueOrThrow({
    where: { id: regularId },
    select: {
      venueId: true,
      groundId: true,
      dayOfWeek: true,
      startHour: true,
      slotCount: true,
      priority: true,
      createdAt: true,
    },
  });
  const others = await tx.venueRegular.findMany({
    where: {
      venueId: self.venueId,
      groundId: self.groundId,
      dayOfWeek: self.dayOfWeek,
      id: { not: regularId },
      pausedAt: null,
      endedAt: null,
    },
    select: { id: true, startHour: true, slotCount: true, priority: true, createdAt: true },
  });
  for (const other of others) {
    const overlaps =
      other.startHour < self.startHour + self.slotCount &&
      self.startHour < other.startHour + other.slotCount;
    const behind =
      other.priority > self.priority ||
      (other.priority === self.priority && other.createdAt > self.createdAt);
    if (overlaps && behind) await releaseWeeks(tx, other.id, "REORDERED", now);
  }
};

const setState = async (
  actor: VenueAccess,
  id: string,
  change: "PAUSE" | "RESUME" | "END",
  clock: Clock,
): Promise<VenueRegularDetail> => {
  const now = clock.now();
  const terms = await termsOf(prisma, actor.venueId);
  const today = localToday(now, terms.timezone);
  await transaction(async (tx) => {
    const regular = await lockRegular(tx, actor.venueId, id);
    const status = statusOf(regular, today);
    if (status === "ENDED") throw regularEnded();
    if (change === "PAUSE" && status === "ACTIVE") {
      await releaseWeeks(tx, regular.id, "PAUSED", now);
      await tx.venueRegular.update({ where: { id: regular.id }, data: { pausedAt: now } });
    } else if (change === "RESUME" && status === "PAUSED") {
      await tx.venueRegular.update({ where: { id: regular.id }, data: { pausedAt: null } });
      await yieldWeeks(tx, regular.id, now);
    } else if (change === "END") {
      await releaseWeeks(tx, regular.id, "ENDED", now);
      await tx.venueRegular.update({ where: { id: regular.id }, data: { endedAt: now } });
    }
  });
  // Weeks it let go may go to the next regular in priority; resuming takes its own back.
  await topUpVenue(actor.venueId, clock);
  return regularDetail(actor, id, clock);
};

export const pauseRegular = (actor: VenueAccess, id: string, clock: Clock = systemClock) =>
  setState(actor, id, "PAUSE", clock);
export const resumeRegular = (actor: VenueAccess, id: string, clock: Clock = systemClock) =>
  setState(actor, id, "RESUME", clock);
export const endRegular = (actor: VenueAccess, id: string, clock: Clock = systemClock) =>
  setState(actor, id, "END", clock);

// Reorders regulars that overlap: they take the same set of priorities, in the order given. A regular
// moved down lets its waiting weeks go, and the top-up hands them out in the new order, so whoever
// is first now has them (user, 2026-11-26); a confirmed week stays with whoever confirmed it.
export const orderRegulars = async (
  actor: VenueAccess,
  { regularIds }: OrderRegulars,
  clock: Clock = systemClock,
): Promise<VenueRegularList> => {
  const ids = [...new Set(regularIds)];
  await transaction(async (tx) => {
    const sorted = [...ids].sort();
    await tx.$queryRaw`
      SELECT id FROM "VenueRegular" WHERE id = ANY(${sorted}::uuid[]) ORDER BY id FOR UPDATE`;
    const rows = await tx.venueRegular.findMany({
      where: { id: { in: ids }, venueId: actor.venueId },
      select: { id: true, priority: true, createdAt: true },
    });
    if (rows.length !== ids.length) throw notOverlapping();
    const before = [...rows]
      .sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime())
      .map((row) => row.id);
    const places = rows.map((row) => row.priority).sort((a, b) => a - b);
    // Distinct places, even if two shared one before.
    for (let i = 1; i < places.length; i++) {
      const previous = places[i - 1] ?? 0;
      if ((places[i] ?? 0) <= previous) places[i] = previous + 1;
    }
    for (const [index, regularId] of ids.entries()) {
      await tx.venueRegular.update({
        where: { id: regularId },
        data: { priority: places[index] ?? index },
      });
      if (index > before.indexOf(regularId)) {
        await releaseWeeks(tx, regularId, "REORDERED", clock.now());
      }
    }
  });
  await topUpVenue(actor.venueId, clock);
  return listRegulars(actor, clock);
};
