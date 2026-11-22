import type {
  BookingHistoryEvent,
  CustomerBookingsQuery,
  StaffBookingPage,
  BookingHistoryQuery,
  StaffBooking,
  StaffBookingsQuery,
} from "@hagz/contracts";
import { StaffBookingDetail } from "@hagz/contracts";
import type { VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { LIVE_STATUSES } from "../domain/status";
import {
  adminBookingDetail,
  bookingHistory,
  presentSummary,
  summarySelect,
} from "./admin-bookings";
import { AppError } from "@/platform/errors/app-error";
import { venueBookingNotFound } from "./booking-rows";
import { staffGame } from "./listings";

const customerNotFound = () =>
  new AppError({
    code: "CUSTOMER_NOT_FOUND",
    status: 404,
    detail: "This venue has no such customer.",
  });

// A venue's bookings for its staff (PR 4.4): the calendar (a day or a week, by ground), the queue of
// bookings waiting for approval, one booking in full, and its history. Only this venue's bookings;
// anyone else's answer as if they didn't exist.

export const staffSelect = {
  ...summarySelect,
  expiresAt: true,
  listing: { select: { status: true, playerCount: true } },
} as const;
const select = staffSelect;

// A staff hold: HELD slots kept by staff for someone deciding. App bookings wait for payment in
// HELD too, but staff never take payment through Hagz, so theirs is always a hold.
export const isHold = (booking: { status: string; creatorId: string | null }) =>
  booking.status === "HELD" && booking.creatorId !== null;

export const presentStaff = (
  row: Parameters<typeof presentSummary>[0] & {
    expiresAt: Date | null;
    listing: { status: string; playerCount: number } | null;
  },
) => ({
  ...presentSummary(row),
  expiresAt: row.expiresAt?.toISOString() ?? null,
  hold: isHold(row),
  openGame:
    row.listing?.status === "OPEN" && row.listing.playerCount > 0
      ? { players: row.listing.playerCount }
      : null,
});

// Bookings overlapping the venue-local days [date, date + span), by start time then ground.
export const listVenueBookings = async (
  actor: VenueAccess,
  query: StaffBookingsQuery,
): Promise<StaffBooking[]> => {
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: actor.venueId },
    select: { marketplace: { select: { timezone: true } } },
  });
  const { timezone } = venue.marketplace;
  const [bounds] = await prisma.$queryRaw<{ from: Date; to: Date }[]>`
    SELECT (${query.date}::date::timestamp AT TIME ZONE ${timezone}) AS "from",
           ((${query.date}::date + ${query.span}::int)::timestamp AT TIME ZONE ${timezone}) AS "to"`;
  if (!bounds) throw new Error("Postgres returned no day bounds.");

  const rows = await prisma.booking.findMany({
    where: {
      venueId: actor.venueId,
      ...(query.groundId && { groundId: query.groundId }),
      status: query.status ?? { in: [...LIVE_STATUSES] },
      startsAt: { lt: bounds.to },
      endsAt: { gt: bounds.from },
    },
    orderBy: [{ startsAt: "asc" }, { groundId: "asc" }, { id: "asc" }],
    select,
  });
  return rows.map(presentStaff);
};

// Waiting for the venue's approval and not yet expired, the ones that expire soonest first.
export const pendingBookings = async (
  actor: VenueAccess,
  clock: Clock = systemClock,
): Promise<StaffBooking[]> => {
  const rows = await prisma.booking.findMany({
    where: { venueId: actor.venueId, status: "PENDING", expiresAt: { gt: clock.now() } },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    select,
  });
  return rows.map(presentStaff);
};

const ensureAtVenue = async (venueId: string, bookingId: string) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, venueId },
    select: { id: true },
  });
  if (!booking) throw venueBookingNotFound();
};

// The admin's view of the booking, without the commission (Hagz's business, not the venue's).
export const staffBookingDetail = async (
  venueId: string,
  bookingId: string,
): Promise<StaffBookingDetail> => {
  await ensureAtVenue(venueId, bookingId);
  const detail = await adminBookingDetail(bookingId);
  return StaffBookingDetail.parse({
    ...detail,
    hold: isHold({ status: detail.status, creatorId: detail.creator?.id ?? null }),
    game: await staffGame(bookingId),
  });
};

export const venueBookingHistory = async (
  actor: VenueAccess,
  bookingId: string,
  query: BookingHistoryQuery,
): Promise<{ data: BookingHistoryEvent[]; nextCursor: string | null }> => {
  await ensureAtVenue(actor.venueId, bookingId);
  return bookingHistory(bookingId, query);
};

// One customer's bookings at the venue, latest game first, a page at a time. A booking the venue
// moved isn't listed; the one that replaced it is.
export const customerBookings = async (
  actor: VenueAccess,
  customerId: string,
  { cursor, limit }: CustomerBookingsQuery,
): Promise<StaffBookingPage> => {
  const customer = await prisma.venueCustomer.findFirst({
    where: { id: customerId, venueId: actor.venueId },
    select: { id: true },
  });
  if (!customer) throw customerNotFound();
  const from = cursor
    ? await prisma.booking.findFirst({
        where: { id: cursor, customerId },
        select: { id: true, startsAt: true },
      })
    : null;
  const rows = await prisma.booking.findMany({
    where: {
      venueId: actor.venueId,
      customerId,
      status: { not: "RESCHEDULED" },
      ...(from && {
        OR: [{ startsAt: { lt: from.startsAt } }, { startsAt: from.startsAt, id: { lt: from.id } }],
      }),
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select,
  });
  const page = rows.slice(0, limit);
  return {
    data: page.map(presentStaff),
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
};
