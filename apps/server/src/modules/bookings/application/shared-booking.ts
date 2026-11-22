import type { SharedBooking } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, placeOf } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { CODE_LENGTH } from "../domain/events";
import { sharedGameId } from "./listings";

// The share link, /b/{code} (PR 4.4): the venue, ground and time, for anyone with the link. No money
// and nothing about the customer. A moved booking points to the one that replaced it.

const linkNotFound = () =>
  new AppError({
    code: "BOOKING_NOT_FOUND",
    status: 404,
    detail: "This booking link doesn't work.",
  });

const names = { translations: { select: { language: true, name: true } } } as const;

export const sharedBooking = async (code: string, language: Language): Promise<SharedBooking> => {
  // Codes are upper case; a link typed or pasted in lower case still works.
  const normalized = code.toUpperCase();
  if (normalized.length !== CODE_LENGTH) throw linkNotFound();
  const booking = await prisma.booking.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      code: true,
      status: true,
      startsAt: true,
      endsAt: true,
      venue: {
        select: {
          id: true,
          slug: true,
          ...names,
          marketplace: { select: { timezone: true } },
          location: { select: { ...names, parent: { select: names } } },
        },
      },
      ground: { select: { id: true, sport: true, size: true, ...names } },
      rescheduledTo: {
        where: { type: { not: "REFILL" } },
        select: { to: { select: { code: true } } },
        take: 1,
      },
    },
  });
  if (!booking) throw linkNotFound();
  return {
    code: booking.code,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    timezone: booking.venue.marketplace.timezone,
    venue: {
      id: booking.venue.id,
      slug: booking.venue.slug,
      name: nameIn(booking.venue.translations, language),
      area: placeOf(booking.venue.location, language),
    },
    ground: {
      id: booking.ground.id,
      name: nameIn(booking.ground.translations, language),
      sport: booking.ground.sport,
      size: booking.ground.size,
    },
    gameId: await sharedGameId(booking.id),
    movedTo: booking.rescheduledTo[0]?.to.code ?? null,
  };
};
