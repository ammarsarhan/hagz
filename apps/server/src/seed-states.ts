import { pathToFileURL } from "node:url";
import {
  createBooking,
  createRegular,
  declineBooking,
  expireDueBookings,
  LIMITS,
  manualCheckIn,
  moveBooking,
} from "@/modules/bookings";
import { ALL_PERMISSIONS } from "@/modules/venues";
import type { Clock } from "@/platform/clock/clock";
import { env } from "@/platform/config/env";
import { prisma } from "@/platform/db/prisma";
import { cache, queueConnection } from "@/platform/redis/connections";

// Development only: the Test Player's bookings in each state the app has a screen for (user,
// 2026-11-24), to walk through on a phone. Every one goes through the real code (createBooking, the
// staff's move and decline, the expiry sweep, a weekly regular, a check-in), with a clock moved
// back where the state needs time to have passed. Each run replaces the last run's set (one of each
// state, user 2026-11-24): its bookings carry TAG as their note, which moves copy along.
//
//   pnpm --filter @hagz/server seed:states

const PLAYER = "+201000000001";
// On every booking this makes; the player never sees a booking's note, staff do.
const TAG = "Seeded for testing (seed:states)";
const HOUR = 3_600_000;

const at = (date: Date): Clock => ({ now: () => date });

const ownerOf = async (venueId: string) => {
  const membership = await prisma.venueMembership.findFirstOrThrow({
    where: { venueId, role: "OWNER" },
    select: { staffId: true },
  });
  return {
    venueId,
    staffId: membership.staffId,
    role: "OWNER" as const,
    permissions: ALL_PERMISSIONS,
  };
};

// Live venues that pay at the venue (nothing to pay online first), confirming by themselves or not.
const venuesWhere = (autoConfirm: boolean) =>
  prisma.venue.findMany({
    where: { status: "LIVE", settings: { autoConfirm, paymentMode: "MANUAL" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

// The first free hour on a one-hour-minimum ground at these venues, starting inside [from, to).
const freeHour = async (venueIds: string[], from: Date, to: Date) => {
  const slot = await prisma.groundSlot.findFirst({
    where: {
      venueId: { in: venueIds },
      status: "AVAILABLE",
      bookingId: null,
      startsAt: { gte: from, lt: to },
      ground: { status: "ACTIVE", settings: { minimumSlots: 1 } },
    },
    orderBy: { startsAt: "asc" },
    select: { groundId: true, venueId: true, startsAt: true, endsAt: true },
  });
  if (!slot) throw new Error(`No free hour between ${from.toISOString()} and ${to.toISOString()}.`);
  return slot;
};

const book = async (
  customerId: string,
  slot: Awaited<ReturnType<typeof freeHour>>,
  clock?: Clock,
) => {
  const { value } = await createBooking(
    customerId,
    {
      groundId: slot.groundId,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      amenities: [],
      note: TAG,
    },
    crypto.randomUUID(),
    clock,
  );
  return value;
};

const codeOf = async (id: string) =>
  (await prisma.booking.findUniqueOrThrow({ where: { id }, select: { code: true } })).code;

// The last run's set, gone: its tagged bookings, whatever they were moved from or to, and the
// Test Player's weekly regulars (only this script makes them) with their weeks. Their slots come
// free again. One transaction, so a failure leaves the last set as it was.
const clearPrevious = async (playerId: string) => {
  const regulars = (
    await prisma.venueRegular.findMany({
      where: { customer: { customerId: playerId } },
      select: { id: true },
    })
  ).map((regular) => regular.id);
  const ids = new Set(
    (
      await prisma.booking.findMany({
        where: { OR: [{ note: TAG }, { regularId: { in: regulars } }] },
        select: { id: true },
      })
    ).map((booking) => booking.id),
  );
  // Follow moves both ways until nothing new turns up.
  for (let size = -1; size !== ids.size;) {
    size = ids.size;
    const links = await prisma.rescheduling.findMany({
      where: { OR: [{ fromBookingId: { in: [...ids] } }, { toBookingId: { in: [...ids] } }] },
      select: { fromBookingId: true, toBookingId: true },
    });
    for (const link of links) {
      ids.add(link.fromBookingId);
      ids.add(link.toBookingId);
    }
  }
  const bookingId = { in: [...ids] };
  await prisma.$transaction([
    prisma.groundSlot.updateMany({
      where: { bookingId },
      data: { bookingId: null, status: "AVAILABLE" },
    }),
    prisma.venueReview.deleteMany({ where: { bookingId } }),
    prisma.cancellation.deleteMany({ where: { bookingId } }),
    prisma.rescheduling.deleteMany({
      where: { OR: [{ fromBookingId: bookingId }, { toBookingId: bookingId }] },
    }),
    prisma.ledgerEntry.deleteMany({ where: { bookingId } }),
    prisma.payment.deleteMany({ where: { bookingId } }),
    prisma.loyaltyStamp.deleteMany({ where: { bookingId } }),
    prisma.notification.deleteMany({ where: { bookingId } }),
    prisma.listingPlayer.deleteMany({ where: { listing: { bookingId } } }),
    prisma.bookingListing.deleteMany({ where: { bookingId } }),
    prisma.booking.deleteMany({ where: { id: bookingId } }),
    prisma.venueRegular.deleteMany({ where: { id: { in: regulars } } }),
  ]);
  return ids.size;
};

export const seedStates = async () => {
  if (env.APP_ENV !== "development") {
    throw new Error(`Refusing to seed booking states in ${env.APP_ENV}: local development only.`);
  }
  // Past the per-player caps on games paid at the venue, as seed:alexandria does for its players.
  LIMITS.payAtVenue = 1_000;
  const player = await prisma.customer.findUniqueOrThrow({
    where: { phone: PLAYER },
    select: { id: true },
  });
  const cleared = await clearPrevious(player.id);
  if (cleared > 0) console.log(`Removed the last run's ${cleared} bookings.`);
  const now = new Date();
  const auto = (await venuesWhere(true)).map((venue) => venue.id);
  const approval = (await venuesWhere(false)).map((venue) => venue.id);
  if (auto.length === 0 || approval.length === 0)
    throw new Error("Need live pay-at-venue venues that confirm by themselves and that don't.");
  const made: Record<string, string> = {};

  // Waiting for the venue: booked at a venue that approves each booking, in two days.
  made.waiting = await codeOf(
    await book(
      player.id,
      await freeHour(approval, new Date(+now + 48 * HOUR), new Date(+now + 72 * HOUR)),
    ),
  );

  // Declined by the venue, with its reason, for a game still ahead (so Similar venues shows).
  {
    const slot = await freeHour(approval, new Date(+now + 72 * HOUR), new Date(+now + 96 * HOUR));
    const id = await book(player.id, slot);
    await declineBooking(await ownerOf(slot.venueId), id, {
      reason: "The pitch is being resurfaced that week.",
    });
    made.declined = await codeOf(id);
  }

  // Not answered in time: booked 13 hours ago, so the 12 hours the venue had have run out; the
  // sweep expires it as the minute's job would.
  {
    const slot = await freeHour(approval, new Date(+now + 30 * HOUR), new Date(+now + 54 * HOUR));
    const id = await book(player.id, slot, at(new Date(+now - 13 * HOUR)));
    await expireDueBookings(at(now));
    made.unanswered = await codeOf(id);
  }

  // Moved by the venue: confirmed, then the owner moves it two hours later on the same ground.
  {
    const slot = await freeHour(auto, new Date(+now + 48 * HOUR), new Date(+now + 72 * HOUR));
    const id = await book(player.id, slot);
    const later = await prisma.groundSlot.findFirst({
      where: {
        groundId: slot.groundId,
        status: "AVAILABLE",
        bookingId: null,
        startsAt: { gt: slot.startsAt, lt: new Date(+slot.startsAt + 12 * HOUR) },
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, endsAt: true },
    });
    if (!later) throw new Error("No later free hour on that ground to move the booking to.");
    const movedId = await moveBooking(await ownerOf(slot.venueId), id, {
      groundId: slot.groundId,
      startsAt: later.startsAt.toISOString(),
      endsAt: later.endsAt.toISOString(),
      reason: "Floodlight repairs on this pitch until later that evening.",
    });
    made.moved = await codeOf(movedId);
  }

  // A weekly game to confirm: a regular at a venue the player already knows, starting this week, so
  // its weeks wait for them to confirm each one.
  {
    const known = await prisma.venueCustomer.findMany({
      where: { customerId: player.id, venue: { status: "LIVE" } },
      select: { id: true, venueId: true },
    });
    const slot = await freeHour(
      known.map((row) => row.venueId),
      new Date(+now + 72 * HOUR),
      new Date(+now + 7 * 24 * HOUR),
    );
    const venue = await prisma.venue.findUniqueOrThrow({
      where: { id: slot.venueId },
      select: { marketplace: { select: { timezone: true } } },
    });
    const local = (date: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: venue.marketplace.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      }).formatToParts(date);
    const part = (parts: Intl.DateTimeFormatPart[], type: string) =>
      parts.find((each) => each.type === type)?.value ?? "";
    const startParts = local(slot.startsAt);
    const todayParts = local(now);
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const customer = known.find((row) => row.venueId === slot.venueId);
    if (!customer) throw new Error("The player isn't a customer of that venue.");
    await createRegular(await ownerOf(slot.venueId), {
      customer: { venueCustomerId: customer.id },
      groundId: slot.groundId,
      dayOfWeek: weekdays.indexOf(part(startParts, "weekday")),
      startHour: Number(part(startParts, "hour")),
      slotCount: 1,
      startsOn: `${part(todayParts, "year")}-${part(todayParts, "month")}-${part(todayParts, "day")}`,
    });
    const week = await prisma.booking.findFirstOrThrow({
      where: { groundId: slot.groundId, startsAt: slot.startsAt, status: "UNCONFIRMED" },
      select: { code: true },
    });
    made.weekly = week.code;
  }

  // Checked in: the game on now (or the latest one today), booked earlier and ticked in by name
  // five minutes after kick-off, as the desk would.
  {
    const slot = await freeHour(
      auto,
      new Date(+now - 50 * 60_000),
      new Date(+now + 10 * 60_000),
    ).catch(() => freeHour(auto, new Date(+now - 6 * HOUR), now));
    const id = await book(player.id, slot, at(new Date(+slot.startsAt - 3 * HOUR)));
    await manualCheckIn(
      await ownerOf(slot.venueId),
      id,
      player.id,
      at(new Date(+slot.startsAt + 5 * 60_000)),
    );
    made.checkedIn = await codeOf(id);
  }

  return made;
};

// Run as a script (not imported).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    for (const [state, code] of Object.entries(await seedStates()))
      console.log(`${state}: ${code}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    cache.disconnect();
    queueConnection.disconnect();
  }
}
