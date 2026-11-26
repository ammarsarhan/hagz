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

export const VenueSlotsQuery = z
  .object({
    date: LocalDate.optional().meta({
      description:
        "The day to read, in the venue's timezone. Left out: today, or the nearest day that has slots.",
    }),
    span: z.coerce.number().int().min(1).max(7).default(1).meta({
      description: "How many days to read from the date, up to a week.",
    }),
  })
  .meta({ id: "VenueSlotsQuery" });

export const Slot = z
  .object({
    id: z.uuid(),
    groundId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    tier: PriceTier,
    price: z.int().meta({ description: "In minor units." }),
    status: SlotStatus,
    isManual: z.boolean().meta({ description: "Set by staff rather than the schedule." }),
    bookingId: z.uuid().nullable(),
  })
  .meta({ id: "Slot" });

// A run of local days (one, or a week) of a venue's grounds' slots, and the days it has any at all:
// the admin's Slots tab and the staff calendar.
export const VenueSlots = z
  .object({
    timezone: z
      .string()
      .meta({ description: "The venue's IANA timezone.", example: "Africa/Cairo" }),
    currency: z
      .string()
      .meta({ description: "ISO 4217; prices are in its minor units.", example: "EGP" }),
    date: LocalDate.meta({ description: "The first day read." }),
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
        minimumSlots: z.int().meta({ description: "The shortest booking, in slots." }),
        maximumSlots: z.int().meta({ description: "The longest booking, in slots." }),
      }),
    ),
    slots: z.array(Slot),
  })
  .meta({ id: "VenueSlots" });

export type SlotStatus = z.infer<typeof SlotStatus>;
export type VenueSlotsQuery = z.infer<typeof VenueSlotsQuery>;
export type VenueSlots = z.infer<typeof VenueSlots>;

// ---------- Staff changes (PR 2.6) ----------

export const MAXIMUM_SLOTS_PER_CHANGE = 500;
// A slot staff add for an occasion: from half an hour to four hours, on a quarter hour.
export const MANUAL_SLOT_MINUTES = { min: 30, max: 240 } as const;

const SlotIds = z.array(z.uuid()).min(1).max(MAXIMUM_SLOTS_PER_CHANGE);
const Price = z.int().min(1).max(100_000_00).meta({ description: "In minor units." });

export const SlotSelection = z
  .object({ slotIds: SlotIds })
  .meta({ id: "SlotSelection", description: "Slots of the venue that haven't started." });

export const SetSlotPrice = z.object({ slotIds: SlotIds, price: Price }).meta({
  id: "SetSlotPrice",
  description:
    "The slots keep this price, and ignore weekly schedule changes, until reset to the schedule. " +
    "A held or booked slot's booking keeps the price it was made at.",
});

export const AddSlots = z
  .object({
    groundId: z.uuid(),
    slots: z
      .array(
        z.object({
          startsAt: z.iso.datetime(),
          endsAt: z.iso.datetime(),
          tier: PriceTier.default("BASE"),
          price: Price,
        }),
      )
      .min(1)
      .max(100),
  })
  .meta({
    id: "AddSlots",
    description:
      "Slots for an occasion (Eid, Ramadan, a match night), kept whatever the weekly schedule says. " +
      "Free slots from the schedule they overlap make way; any other overlap is refused.",
  });

export const ChangedSlots = z.object({ slots: z.array(Slot) }).meta({ id: "ChangedSlots" });

export type Slot = z.infer<typeof Slot>;
export type SlotSelection = z.infer<typeof SlotSelection>;
export type SetSlotPrice = z.infer<typeof SetSlotPrice>;
export type AddSlots = z.infer<typeof AddSlots>;
export type ChangedSlots = z.infer<typeof ChangedSlots>;
