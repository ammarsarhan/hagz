import type { ConfirmLink, ReminderWeek } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { webLinks } from "@/platform/http/links";
import { consume } from "@/platform/rate-limit/rate-limit";
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
    detail: "Only a regular's week still waiting for an answer has a confirm link.",
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
      expiresAt: true,
      customer: { select: { customer: { select: { language: true } } } },
    },
  });
  if (!booking) throw venueBookingNotFound();
  if (
    booking.status !== "UNCONFIRMED" ||
    !booking.regularId ||
    !booking.expiresAt ||
    booking.expiresAt <= now
  ) {
    throw notWaiting();
  }
  await consume(COPIES, booking.id);
  const token = randomToken();
  await prisma.reminderToken.create({
    data: { bookingId: booking.id, tokenHash: hashToken(token), expiresAt: booking.expiresAt },
  });
  // In the regular's language when they have the app, else Arabic, the page's own default.
  const language = booking.customer.customer?.language === "EN" ? "en" : "ar";
  return {
    url: webLinks.weekConfirm(token, language),
    expiresAt: booking.expiresAt.toISOString(),
  };
};

const weekSelect = {
  id: true,
  status: true,
  startsAt: true,
  endsAt: true,
  expiresAt: true,
  customer: { select: { name: true, customerId: true } },
  venue: {
    select: {
      slug: true,
      translations: { select: { language: true, name: true } },
      marketplace: { select: { timezone: true } },
    },
  },
  ground: { select: { translations: { select: { language: true, name: true } } } },
} as const;

const findToken = (token: string) =>
  prisma.reminderToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, expiresAt: true, usedAt: true, booking: { select: weekSelect } },
  });

type Found = NonNullable<Awaited<ReturnType<typeof findToken>>>;

const stateOf = (found: Found, now: Date): ReminderWeek["state"] => {
  const { booking } = found;
  if (booking.status === "CONFIRMED" || booking.status === "COMPLETED") return "CONFIRMED";
  if (booking.status === "RELEASED") return "RELEASED";
  const open =
    booking.status === "UNCONFIRMED" &&
    !found.usedAt &&
    found.expiresAt > now &&
    booking.expiresAt !== null &&
    booking.expiresAt > now;
  return open ? "WAITING" : "EXPIRED";
};

const viewOf = (found: Found, language: Language, now: Date): ReminderWeek => {
  const { booking } = found;
  return {
    state: stateOf(found, now),
    name: booking.customer.name.trim().split(/\s+/)[0] ?? booking.customer.name,
    venue: { name: nameIn(booking.venue.translations, language), slug: booking.venue.slug },
    ground: nameIn(booking.ground.translations, language),
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
