import type {
  CheckInCode,
  CheckInPerson,
  CheckInResult,
  CheckInWindow,
  StaffCheckIn,
} from "@hagz/contracts";
import type { VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { signJwt, verifyJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { checkInWindow, CODE_SECONDS, inCheckInWindow, REFRESH_SECONDS } from "../domain/check-in";
import { firstName } from "../domain/listings";
import { lockBooking, venueBookingNotFound } from "./booking-rows";
import { bookingNotFound } from "./my-bookings";

// Checking in at the venue (user, 2026-11-22). The booker of an app booking and each joined
// open-game player show a QR code that changes every 30 seconds (a signed token naming the booking
// or game, good for 60), so a screenshot sent to a friend soon stops working. Staff scan it, or tick
// someone in by name if their phone died, from 15 minutes before kick-off until 30 minutes after, and
// can undo a mistake in that time. Staff-entered and regular bookings have no check-in: those
// players may not have the app.

const BOOKER = "B";
const PLAYER = "G";

const notCheckable = () =>
  new AppError({
    code: "NO_CHECK_IN",
    status: 409,
    detail: "This booking doesn't take check-ins: it isn't a confirmed booking made in the app.",
  });
const badCode = () =>
  new AppError({
    code: "CHECK_IN_CODE_INVALID",
    status: 422,
    detail: "This code isn't valid. Ask them to open it again in the app.",
  });
const expiredCode = () =>
  new AppError({
    code: "CHECK_IN_CODE_EXPIRED",
    status: 422,
    detail: "This code has expired. Ask them to open it again in the app.",
  });
const otherVenue = () =>
  new AppError({
    code: "CHECK_IN_OTHER_VENUE",
    status: 409,
    detail: "This booking is at another venue.",
  });
const windowClosed = (window: { opensAt: Date; closesAt: Date }) =>
  new AppError({
    code: "CHECK_IN_CLOSED",
    status: 409,
    detail: "Check-in is open from 15 minutes before kick-off until 30 minutes after.",
    extensions: { opensAt: window.opensAt.toISOString(), closesAt: window.closesAt.toISOString() },
  });
const notInBooking = () =>
  new AppError({
    code: "NOT_IN_BOOKING",
    status: 404,
    detail: "They aren't the booker or a joined player of this booking.",
  });

// An app booking (not entered by staff, not a regular's) that's confirmed or was played.
const takesCheckIns = (booking: { creatorId: string | null; regularId: string | null }) =>
  booking.creatorId === null && booking.regularId === null;

export const bookingCheckIn = (booking: {
  creatorId: string | null;
  regularId: string | null;
  status: string;
  startsAt: Date;
  checkedInAt: Date | null;
}): CheckInWindow | null => {
  if (!takesCheckIns(booking)) return null;
  if (!["CONFIRMED", "COMPLETED", "NO_SHOW"].includes(booking.status)) return null;
  const window = checkInWindow(booking.startsAt);
  return {
    opensAt: window.opensAt.toISOString(),
    closesAt: window.closesAt.toISOString(),
    checkedInAt: booking.checkedInAt?.toISOString() ?? null,
  };
};

const issue = async (subject: string, customerId: string, now: Date): Promise<CheckInCode> => ({
  code: await signJwt(
    { sub: customerId, sid: subject },
    { audience: "check-in", ttlSeconds: CODE_SECONDS },
    { now: () => now },
  ),
  expiresAt: new Date(now.getTime() + CODE_SECONDS * 1000).toISOString(),
  refreshAt: new Date(now.getTime() + REFRESH_SECONDS * 1000).toISOString(),
});

// The booker's code for their booking.
export const bookerCode = async (
  customerId: string,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<CheckInCode> => {
  const now = clock.now();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      creatorId: true,
      regularId: true,
      startsAt: true,
      customer: { select: { customerId: true } },
    },
  });
  if (booking?.customer.customerId !== customerId) throw bookingNotFound();
  if (!takesCheckIns(booking) || booking.status !== "CONFIRMED") throw notCheckable();
  if (now > checkInWindow(booking.startsAt).closesAt)
    throw windowClosed(checkInWindow(booking.startsAt));
  return issue(`${BOOKER}:${bookingId}`, customerId, now);
};

// A joined player's code for a game.
export const playerCode = async (
  customerId: string,
  listingId: string,
  clock: Clock = systemClock,
): Promise<CheckInCode> => {
  const now = clock.now();
  const player = await prisma.listingPlayer.findUnique({
    where: { listingId_customerId: { listingId, customerId } },
    select: {
      status: true,
      listing: { select: { booking: { select: { status: true, startsAt: true } } } },
    },
  });
  if (player?.status !== "JOINED") {
    throw new AppError({
      code: "NOT_JOINED",
      status: 409,
      detail: "You haven't joined this game.",
    });
  }
  const { booking } = player.listing;
  if (booking.status !== "CONFIRMED") throw notCheckable();
  if (now > checkInWindow(booking.startsAt).closesAt)
    throw windowClosed(checkInWindow(booking.startsAt));
  return issue(`${PLAYER}:${listingId}`, customerId, now);
};

const bookingSelect = {
  id: true,
  venueId: true,
  status: true,
  creatorId: true,
  regularId: true,
  startsAt: true,
  checkedInAt: true,
  customer: { select: { customerId: true, customer: { select: { name: true } } } },
  listing: { select: { id: true } },
} as const;

type Locked = NonNullable<Awaited<ReturnType<typeof lockForCheckIn>>>;

const lockForCheckIn = (tx: Tx, bookingId: string, venueId: string | null) =>
  lockBooking(tx, bookingId, venueId, bookingSelect);

const checkOpen = (booking: Locked, now: Date) => {
  if (!takesCheckIns(booking) || booking.status !== "CONFIRMED") throw notCheckable();
  if (!inCheckInWindow(booking.startsAt, now)) throw windowClosed(checkInWindow(booking.startsAt));
};

// Checks one person in (or reports they already were). `manual`: ticked in by name.
const checkIn = async (
  tx: Tx,
  actor: VenueAccess,
  booking: Locked,
  customerId: string,
  manual: boolean,
  now: Date,
): Promise<CheckInResult> => {
  if (booking.customer.customerId === customerId) {
    const already = booking.checkedInAt !== null;
    if (!already) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { checkedInAt: now, checkedInById: actor.staffId, checkedInManually: manual },
      });
    }
    const name = booking.customer.customer?.name ?? "";
    return {
      bookingId: booking.id,
      person: {
        customerId,
        firstName: firstName(name),
        role: "BOOKER",
        checkedInAt: (booking.checkedInAt ?? now).toISOString(),
        manual: already ? false : manual,
      },
      already,
    };
  }
  if (!booking.listing) throw notInBooking();
  const player = await tx.listingPlayer.findUnique({
    where: { listingId_customerId: { listingId: booking.listing.id, customerId } },
    select: {
      status: true,
      checkedInAt: true,
      checkedInManually: true,
      customer: { select: { name: true } },
    },
  });
  if (player?.status !== "JOINED") throw notInBooking();
  const already = player.checkedInAt !== null;
  if (!already) {
    await tx.listingPlayer.update({
      where: { listingId_customerId: { listingId: booking.listing.id, customerId } },
      data: { checkedInAt: now, checkedInById: actor.staffId, checkedInManually: manual },
    });
  }
  return {
    bookingId: booking.id,
    person: {
      customerId,
      firstName: firstName(player.customer.name),
      role: "PLAYER",
      checkedInAt: (player.checkedInAt ?? now).toISOString(),
      manual: already ? player.checkedInManually : manual,
    },
    already,
  };
};

// A scanned QR code. A code for another venue's booking is refused without changing anything.
export const scanCheckIn = async (
  actor: VenueAccess,
  code: string,
  clock: Clock = systemClock,
): Promise<CheckInResult> => {
  const now = clock.now();
  let claims: { sub: string; sid: string };
  try {
    claims = await verifyJwt(code, "check-in", { now: () => now });
  } catch (error) {
    if (error instanceof AppError && error.code === "TOKEN_EXPIRED") throw expiredCode();
    throw badCode();
  }
  const [kind, id] = claims.sid.split(":");
  if (!id || (kind !== BOOKER && kind !== PLAYER)) throw badCode();
  const bookingId =
    kind === BOOKER
      ? id
      : (await prisma.bookingListing.findUnique({ where: { id }, select: { bookingId: true } }))
          ?.bookingId;
  if (!bookingId) throw badCode();
  return transaction(async (tx) => {
    const booking = await lockForCheckIn(tx, bookingId, null);
    if (!booking) throw badCode();
    if (booking.venueId !== actor.venueId) throw otherVenue();
    checkOpen(booking, now);
    return checkIn(tx, actor, booking, claims.sub, false, now);
  });
};

// Ticked in by name, for someone whose phone died.
export const manualCheckIn = async (
  actor: VenueAccess,
  bookingId: string,
  customerId: string,
  clock: Clock = systemClock,
): Promise<CheckInResult> => {
  const now = clock.now();
  return transaction(async (tx) => {
    const booking = await lockForCheckIn(tx, bookingId, actor.venueId);
    if (!booking) throw venueBookingNotFound();
    checkOpen(booking, now);
    return checkIn(tx, actor, booking, customerId, true, now);
  });
};

// Undoes a mistaken check-in, while check-in is still open.
export const undoCheckIn = async (
  actor: VenueAccess,
  bookingId: string,
  customerId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const booking = await lockForCheckIn(tx, bookingId, actor.venueId);
    if (!booking) throw venueBookingNotFound();
    checkOpen(booking, now);
    const cleared = { checkedInAt: null, checkedInById: null, checkedInManually: false };
    if (booking.customer.customerId === customerId) {
      await tx.booking.update({ where: { id: booking.id }, data: cleared });
      return;
    }
    if (!booking.listing) throw notInBooking();
    const { count } = await tx.listingPlayer.updateMany({
      where: { listingId: booking.listing.id, customerId, status: "JOINED" },
      data: cleared,
    });
    if (count === 0) throw notInBooking();
  });
};

// Who has checked in, for the staff booking page.
export const staffCheckIn = async (bookingId: string): Promise<StaffCheckIn | null> => {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      creatorId: true,
      regularId: true,
      status: true,
      startsAt: true,
      checkedInAt: true,
      checkedInManually: true,
      customer: { select: { customerId: true, customer: { select: { name: true } } } },
      listing: {
        select: {
          players: {
            where: { status: "JOINED" },
            orderBy: { joinedAt: "asc" },
            select: {
              customerId: true,
              checkedInAt: true,
              checkedInManually: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  const window = bookingCheckIn(booking);
  const account = booking.customer.customerId;
  if (!window || !account) return null;
  const people: CheckInPerson[] = [
    {
      customerId: account,
      firstName: firstName(booking.customer.customer?.name ?? ""),
      role: "BOOKER",
      checkedInAt: booking.checkedInAt?.toISOString() ?? null,
      manual: booking.checkedInManually,
    },
    ...(booking.listing?.players ?? []).map((player) => ({
      customerId: player.customerId,
      firstName: firstName(player.customer.name),
      role: "PLAYER" as const,
      checkedInAt: player.checkedInAt?.toISOString() ?? null,
      manual: player.checkedInManually,
    })),
  ];
  return { opensAt: window.opensAt, closesAt: window.closesAt, people };
};
