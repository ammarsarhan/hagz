import type { ConfirmLink, ReminderWeek } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, placeOf, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { webLinks } from "@/platform/http/links";
import { consume } from "@/platform/rate-limit/rate-limit";
import { BOOKING_EVENTS } from "../domain/events";
import { venueBookingNotFound } from "./booking-rows";
import { confirmIn, releaseIn } from "./reservations";
import { topUpVenue } from "./regulars";

// Confirm links (docs/regulars.md "Reminders"): staff copy one for a regular's waiting week and send
// it from their own WhatsApp; Hagz sends nothing. Only the token's hash is stored, so each copy is a
// new link. A link works once, until the week's deadline, and every link for a week stops working
// once the week is answered, however it was.

const HOUR_MS = 60 * 60 * 1000;
// Copies per week an hour: plenty for staff resending, not a token mill.
const COPIES = { name: "regulars:confirm-link", limit: 10, windowMs: HOUR_MS, failOpen: true };

const linkNotFound = () =>
  new AppError({
    code: "CONFIRM_LINK_NOT_FOUND",
    status: 404,
    detail: "This link isn't one of ours.",
  });

const notWaiting = () =>
  new AppError({
    code: "RESERVATION_NOT_WAITING",
    status: 409,
    detail: "Only a regular's coming week, confirmed or still waiting for an answer, has a link.",
  });

const unavailable = () =>
  new AppError({
    code: "LINKS_UNAVAILABLE",
    status: 503,
    detail: "Links can't be made in this environment yet.",
  });

export const createConfirmLink = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<ConfirmLink> => {
  if (!webLinks) throw unavailable();
  const now = clock.now();
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, venueId: actor.venueId },
    select: {
      id: true,
      status: true,
      regularId: true,
      startsAt: true,
      expiresAt: true,
      customer: { select: { customer: { select: { language: true } } } },
    },
  });
  if (!booking) throw venueBookingNotFound();
  // A waiting week until its deadline; a confirmed one until kick-off, where the page says it's on
  // (user, 2026-11-27: the link is for the very next week, whatever its state).
  const until =
    booking.status === "UNCONFIRMED"
      ? booking.expiresAt
      : booking.status === "CONFIRMED"
        ? booking.startsAt
        : null;
  if (!booking.regularId || !until || until <= now) throw notWaiting();
  await consume(COPIES, booking.id);
  const token = randomToken();
  await prisma.reminderToken.create({
    data: { bookingId: booking.id, tokenHash: hashToken(token), expiresAt: until },
  });
  // In the regular's language when they have the app, else Arabic, the page's own default.
  const language = booking.customer.customer?.language === "EN" ? "en" : "ar";
  return {
    url: webLinks.regularConfirm(token, language),
    expiresAt: until.toISOString(),
  };
};

const names = { translations: { select: { language: true, name: true } } } as const;

const weekSelect = {
  id: true,
  code: true,
  status: true,
  startsAt: true,
  endsAt: true,
  expiresAt: true,
  customer: { select: { name: true, customerId: true } },
  venue: {
    select: {
      slug: true,
      ...names,
      marketplace: { select: { timezone: true } },
      location: { select: { ...names, parent: { select: names } } },
    },
  },
  ground: { select: { sport: true, size: true, ...names } },
  // How it was let go, if it was: by the regular, by its deadline, or by the venue.
  events: {
    where: { type: { in: [BOOKING_EVENTS.RELEASED, BOOKING_EVENTS.REGULAR_CHANGED] as string[] } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { type: true, data: true },
  },
} as const;

const findToken = (token: string) =>
  prisma.reminderToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, expiresAt: true, usedAt: true, booking: { select: weekSelect } },
  });

type Found = NonNullable<Awaited<ReturnType<typeof findToken>>>;

// The page says what became of the week, and who decided it (user, 2026-11-26): a week let go reads
// "not this week" only when the regular said so. A link follows the week's own deadline, so a longer
// Confirm by set after it was copied keeps it working.
const stateOf = (found: Found, now: Date): ReminderWeek["state"] => {
  const { booking } = found;
  if (booking.status === "CONFIRMED" || booking.status === "COMPLETED") return "CONFIRMED";
  if (booking.status === "RELEASED") {
    const event = booking.events[0];
    const by =
      event?.type === BOOKING_EVENTS.RELEASED &&
      event.data !== null &&
      typeof event.data === "object" &&
      "by" in event.data
        ? event.data.by
        : null;
    if (by === "CUSTOMER") return "RELEASED";
    if (by === "DEADLINE") return "MISSED";
    return "CHANGED";
  }
  if (booking.status !== "UNCONFIRMED" || found.usedAt) return "CHANGED";
  // Past its deadline, before the minute's sweep lets it go.
  if (booking.expiresAt === null || booking.expiresAt <= now) return "MISSED";
  return "WAITING";
};

const viewOf = (found: Found, language: Language, now: Date): ReminderWeek => {
  const { booking } = found;
  return {
    state: stateOf(found, now),
    code: booking.code,
    name: booking.customer.name.trim().split(/\s+/)[0] ?? booking.customer.name,
    venue: {
      name: nameIn(booking.venue.translations, language),
      slug: booking.venue.slug,
      area: placeOf(booking.venue.location, language),
    },
    ground: {
      name: nameIn(booking.ground.translations, language),
      sport: booking.ground.sport,
      size: booking.ground.size,
    },
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    deadline: booking.expiresAt?.toISOString() ?? null,
    timezone: booking.venue.marketplace.timezone,
  };
};

// What the page shows: the week, and whether it can still be answered.
export const confirmLinkWeek = async (
  token: string,
  language: Language,
  clock: Clock = systemClock,
): Promise<ReminderWeek> => {
  const found = await findToken(token);
  if (!found) throw linkNotFound();
  return viewOf(found, language, clock.now());
};

// Confirms or lets the week go, and uses the link up, in one transaction. A link that can't answer
// any more says why with the week as it now is, rather than an error: the page shows it.
export const answerConfirmLink = async (
  token: string,
  answer: "CONFIRM" | "RELEASE",
  language: Language,
  clock: Clock = systemClock,
): Promise<ReminderWeek> => {
  const now = clock.now();
  const released = await transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ReminderToken" WHERE "tokenHash" = ${hashToken(token)} FOR UPDATE`;
    const id = rows[0]?.id;
    if (!id) throw linkNotFound();
    const found = await tx.reminderToken.findUniqueOrThrow({
      where: { id },
      select: { id: true, expiresAt: true, usedAt: true, booking: { select: weekSelect } },
    });
    if (stateOf(found, now) !== "WAITING") return null;
    const who = { link: { customerId: found.booking.customer.customerId } };
    const venueId =
      answer === "CONFIRM"
        ? (await confirmIn(tx, who, found.booking.id, now), null)
        : await releaseIn(tx, who, found.booking.id, now);
    await tx.reminderToken.update({ where: { id }, data: { usedAt: now } });
    return { venueId };
  });
  if (released?.venueId) await topUpVenue(released.venueId, clock);
  return confirmLinkWeek(token, language, clock);
};
