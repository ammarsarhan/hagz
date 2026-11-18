import { z } from "zod";
import { GroundSize, GroundSport, PriceTier } from "./grounds";

// Bookable hours (GroundSlot), generated ahead from each ground's weekly schedule (docs/plan.md
// 2.6). Times are instants; a venue's day is its marketplace's local day.

export const SlotStatus = z.enum(["AVAILABLE", "HELD", "BOOKED", "BLOCKED"]).meta({
  id: "SlotStatus",
  description:
    "`HELD`: reserved while a booking awaits payment or confirmation. `BLOCKED`: closed by staff.",
});

const LocalDate = z.iso
  .date()
  .meta({ description: "A local date, YYYY-MM-DD.", example: "2026-11-19" });

export const AdminVenueSlotsQuery = z
  .object({
    date: LocalDate.optional().meta({
      description:
        "The day to read, in the venue's timezone. Left out: today, or the nearest day that has slots.",
    }),
  })
  .meta({ id: "AdminVenueSlotsQuery" });

// A venue's admin Slots tab: one local day of its grounds' slots, and the days it has any at all.
export const AdminVenueSlots = z
  .object({
    timezone: z
      .string()
      .meta({ description: "The venue's IANA timezone.", example: "Africa/Cairo" }),
    currency: z
      .string()
      .meta({ description: "ISO 4217; prices are in its minor units.", example: "EGP" }),
    date: LocalDate.meta({ description: "The day read." }),
    days: z
      .object({ first: LocalDate, last: LocalDate })
      .nullable()
      .meta({ description: "The first and last days with slots; null until any are generated." }),
    grounds: z.array(
      z.object({
        id: z.uuid(),
        name: z.string().nullable(),
        sport: GroundSport,
        size: GroundSize,
      }),
    ),
    slots: z.array(
      z.object({
        id: z.uuid(),
        groundId: z.uuid(),
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        tier: PriceTier,
        price: z.int().meta({ description: "In minor units." }),
        status: SlotStatus,
        isManual: z.boolean().meta({ description: "Set by staff rather than the schedule." }),
        bookingId: z.uuid().nullable(),
      }),
    ),
  })
  .meta({ id: "AdminVenueSlots" });

export type SlotStatus = z.infer<typeof SlotStatus>;
export type AdminVenueSlotsQuery = z.infer<typeof AdminVenueSlotsQuery>;
export type AdminVenueSlots = z.infer<typeof AdminVenueSlots>;
