import type { BookingPage, BookingsQuery } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, placeOf } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { storage } from "@/platform/storage/storage";
import { bookingNotFound } from "./booking-rows";

// A player's bookings (PR 4.4): the Bookings tab's Upcoming and Past, and one booking's detail. A
// player's bookings are spread over one VenueCustomer per venue, all linked to their account.

const STILL_TO_PLAY = ["PENDING", "HELD", "UNCONFIRMED", "CONFIRMED"] as const;

const invalidCursor = () =>
  new AppError({
    code: "INVALID_CURSOR",
    status: 400,
    detail: "That page link has expired. Load the list again.",
  });

interface Cursor {
  startsAt: Date;
  id: string;
}

const encodeCursor = ({ startsAt, id }: Cursor) =>
  Buffer.from(JSON.stringify([startsAt.toISOString(), id])).toString("base64url");

const decodeCursor = (text: string): Cursor => {
  try {
    const [startsAt, id] = JSON.parse(Buffer.from(text, "base64url").toString()) as unknown[];
    if (typeof startsAt !== "string" || typeof id !== "string") throw new Error("Malformed.");
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) throw new Error("Malformed.");
    return { startsAt: date, id };
  } catch {
    throw invalidCursor();
  }
};

const names = { translations: { select: { language: true, name: true } } } as const;

// Upcoming soonest first; past latest first. Ties on startsAt (two grounds at once) by id.
export const listMyBookings = async (
  customerId: string,
  query: BookingsQuery,
  language: Language,
  clock: Clock = systemClock,
): Promise<BookingPage> => {
  const now = clock.now();
  const upcoming = query.when === "upcoming";
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const direction = upcoming ? "gt" : "lt";

  const when: Prisma.BookingWhereInput = upcoming
    ? { status: { in: [...STILL_TO_PLAY] }, endsAt: { gt: now } }
    : {
        status: { not: "RESCHEDULED" },
        OR: [{ status: { notIn: [...STILL_TO_PLAY] } }, { endsAt: { lte: now } }],
      };
  const after: Prisma.BookingWhereInput = cursor
    ? {
        OR: [
          { startsAt: { [direction]: cursor.startsAt } },
          { startsAt: cursor.startsAt, id: { [direction]: cursor.id } },
        ],
      }
    : {};
  const order = upcoming ? "asc" : "desc";

  const rows = await prisma.booking.findMany({
    where: { customer: { customerId }, AND: [when, after] },
    orderBy: [{ startsAt: order }, { id: order }],
    take: query.limit + 1,
    select: {
      id: true,
      code: true,
      status: true,
      startsAt: true,
      endsAt: true,
      expiresAt: true,
      total: true,
      venue: {
        select: {
          id: true,
          slug: true,
          ...names,
          marketplace: { select: { currency: true } },
          location: { select: { ...names, parent: { select: names } } },
          media: {
            where: { type: "IMAGE", status: "READY" },
            orderBy: [{ position: "asc" }, { id: "asc" }],
            take: 1,
            select: { key: true },
          },
        },
      },
      ground: { select: { id: true, sport: true, size: true, ...names } },
    },
  });

  const pageRows = rows.slice(0, query.limit);
  const last = pageRows.at(-1);
  return {
    data: pageRows.map((booking) => {
      const cover = booking.venue.media[0];
      return {
        id: booking.id,
        code: booking.code,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        expiresAt: booking.expiresAt?.toISOString() ?? null,
        venue: {
          id: booking.venue.id,
          slug: booking.venue.slug,
          name: nameIn(booking.venue.translations, language),
          area: placeOf(booking.venue.location, language),
          cover: cover ? { url: storage.publicUrl(cover.key) } : null,
        },
        ground: {
          id: booking.ground.id,
          name: nameIn(booking.ground.translations, language),
          sport: booking.ground.sport,
          size: booking.ground.size,
        },
        currency: booking.venue.marketplace.currency,
        total: booking.total,
      };
    }),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
  };
};

// Whether the booking is the player's own; anyone else's answers as if it didn't exist.
export const ensureMyBooking = async (customerId: string, bookingId: string) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customer: { customerId } },
    select: { id: true },
  });
  if (!booking) throw bookingNotFound();
};
