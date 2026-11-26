import type { SetupItemKey } from "@hagz/contracts";
import { createHash } from "node:crypto";
import type { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/transaction";
import { pinOf } from "./venue-edit";
import { GONE_GROUNDS } from "../domain/grounds";

// What a setup section holds, reduced to a fingerprint, so a send-back can tell whether the owner
// changed a section it asked them to change (docs/onboarding.md, step 3). The send-back keeps each
// flagged section's fingerprint; the section counts as changed while its fingerprint now differs.
// Changing something and changing it back leaves the fingerprint as it was, which an edit log
// can't tell.
//
// Each section reads exactly what the owner can edit in it, in a fixed order. A field added to a
// section later belongs here too, or changing only that field won't count.

type Db = Tx | typeof prisma;

// The same value always serializes the same way: object keys sorted, arrays as given (so order
// counts only where it's read in order).
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const fingerprint = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

const byLanguage = <T extends { language: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.language.localeCompare(b.language));

// Grounds still on the venue (paused ones too: pausing is an edit to Grounds), in display order.
const grounds = (db: Db, venueId: string) =>
  db.ground.findMany({
    where: { venueId, status: { notIn: [...GONE_GROUNDS] } },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sport: true,
      size: true,
      surface: true,
      environment: true,
      status: true,
      basePrice: true,
      peakPrice: true,
      discountPrice: true,
      translations: { select: { language: true, name: true } },
      settings: { select: { minimumSlots: true, maximumSlots: true } },
      schedules: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, hours: true } },
    },
  });

const CONTENTS: Record<SetupItemKey, (db: Db, venueId: string) => Promise<unknown>> = {
  DETAILS: async (db, venueId) => {
    const venue = await db.venue.findUniqueOrThrow({
      where: { id: venueId },
      select: {
        phone: true,
        translations: { select: { language: true, name: true, description: true, address: true } },
      },
    });
    return { phone: venue.phone, translations: byLanguage(venue.translations) };
  },
  LOCATION: async (db, venueId) => {
    const venue = await db.venue.findUniqueOrThrow({
      where: { id: venueId },
      select: { locationId: true, requestedArea: true },
    });
    return { ...venue, pin: await pinOf(db, venueId) };
  },
  PHOTOS: (db, venueId) =>
    db.venueMedia
      .findMany({
        where: { venueId, type: "IMAGE", status: "READY" },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true },
      })
      .then((photos) => photos.map((photo) => photo.id)),
  // Everything about each ground but its hours, which are Schedules.
  GROUNDS: async (db, venueId) =>
    (await grounds(db, venueId)).map((ground) => ({
      id: ground.id,
      sport: ground.sport,
      size: ground.size,
      surface: ground.surface,
      environment: ground.environment,
      status: ground.status,
      basePrice: ground.basePrice,
      peakPrice: ground.peakPrice,
      discountPrice: ground.discountPrice,
      settings: ground.settings,
      translations: byLanguage(ground.translations),
    })),
  SCHEDULES: async (db, venueId) =>
    (await grounds(db, venueId)).map((ground) => ({ id: ground.id, schedules: ground.schedules })),
  LAYOUT: (db, venueId) =>
    db.venueLayout.findUnique({
      where: { venueId },
      select: {
        columns: true,
        rows: true,
        entrances: true,
        items: {
          orderBy: [{ y: "asc" }, { x: "asc" }, { id: "asc" }],
          select: {
            type: true,
            groundId: true,
            optionId: true,
            x: true,
            y: true,
            orientation: true,
            width: true,
            height: true,
          },
        },
      },
    }),
  SETTINGS: (db, venueId) =>
    db.venueSettings.findUnique({
      where: { venueId },
      select: {
        autoConfirm: true,
        minimumNotice: true,
        paymentMode: true,
        depositPercent: true,
        cancellationPolicy: true,
        cancellationTiers: true,
        loyaltyStamps: true,
        loyaltyWindow: true,
      },
    }),
  AMENITIES: (db, venueId) =>
    db.venueAmenity.findMany({
      where: { venueId },
      orderBy: { optionId: "asc" },
      select: { optionId: true, price: true, pricing: true },
    }),
  TAX_NUMBER: (db, venueId) =>
    db.venue
      .findUniqueOrThrow({ where: { id: venueId }, select: { taxNumber: true } })
      .then((venue) => venue.taxNumber),
};

// Each section's fingerprint, now. One at a time: inside a transaction the queries share one
// connection anyway.
export const sectionFingerprints = async (
  db: Db,
  venueId: string,
  keys: SetupItemKey[],
): Promise<Partial<Record<SetupItemKey, string>>> => {
  const prints: Partial<Record<SetupItemKey, string>> = {};
  for (const key of keys) prints[key] = fingerprint(await CONTENTS[key](db, venueId));
  return prints;
};
