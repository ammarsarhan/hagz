import { z } from "zod";
import { CreateHold, StaffBooking } from "./staff-bookings";

// Regulars (PR 4.5, docs/regulars.md): a customer's standing weekly time at a venue. Hagz keeps an
// UNCONFIRMED reservation for each week up to the venue's horizon; each is confirmed or released
// before its deadline.

const LocalDate = z.iso
  .date()
  .meta({ description: "A calendar day in the venue's timezone.", example: "2026-12-03" });
const Instant = z.iso.datetime();

const Time = {
  groundId: z.uuid(),
  dayOfWeek: z.int().min(0).max(6).meta({ description: "0–6 from Sunday, in the venue's time." }),
  startHour: z.int().min(0).max(23).meta({ description: "The first hour, in the venue's time." }),
  slotCount: z.int().min(1).max(24).meta({ description: "How many hours they play." }),
};

export const RegularStatus = z
  .enum(["ACTIVE", "PAUSED", "ENDED"])
  .meta({ id: "RegularStatus", description: "`ENDED`: its end date has come." });

export const Reliability = z
  .object({
    confirmed: z.int().meta({ description: "Weeks confirmed, by staff or the regular." }),
    released: z.int().meta({ description: "Weeks let go before the deadline." }),
    missed: z.int().meta({ description: "Weeks nobody answered by the deadline." }),
    cancelled: z.int().meta({ description: "Weeks confirmed, then cancelled." }),
    noShows: z.int(),
  })
  .meta({
    id: "Reliability",
    description: "Weeks released because the regular itself changed don't count.",
  });

export const VenueRegular = z
  .object({
    id: z.uuid(),
    status: RegularStatus,
    customer: z.object({
      id: z.uuid(),
      name: z.string(),
      phone: z.string().nullable(),
      app: z.boolean(),
    }),
    ground: z.object({ id: z.uuid(), name: z.string().nullable() }),
    dayOfWeek: Time.dayOfWeek,
    startHour: Time.startHour,
    slotCount: Time.slotCount,
    startsOn: LocalDate,
    endsOn: LocalDate.nullable(),
    pausedAt: Instant.nullable(),
    priority: z.int().meta({
      description: "Among regulars that overlap, lower reserves a week first.",
    }),
    reliability: Reliability,
    createdAt: Instant,
  })
  .meta({ id: "VenueRegular" });

export const VenueRegularList = z
  .object({ data: z.array(VenueRegular) })
  .meta({ id: "VenueRegularList" });

export const VenueRegularDetail = VenueRegular.extend({
  reservations: z.array(StaffBooking).meta({
    description: "Its reservations still to be played, soonest first.",
  }),
  skippedWeeks: z.array(LocalDate).meta({
    description:
      "Weeks inside the horizon it couldn't reserve: the time was taken or closed. Tried again every day.",
  }),
}).meta({ id: "VenueRegularDetail" });

export const CreateRegular = z
  .object({
    customer: CreateHold.shape.customer,
    ...Time,
    startsOn: LocalDate,
    endsOn: LocalDate.optional(),
  })
  .meta({ id: "CreateRegular" });

export const UpdateRegular = z
  .object({
    groundId: Time.groundId.optional(),
    dayOfWeek: Time.dayOfWeek.optional(),
    startHour: Time.startHour.optional(),
    slotCount: Time.slotCount.optional(),
    endsOn: LocalDate.nullable().optional().meta({ description: "null: no end date." }),
  })
  .meta({
    id: "UpdateRegular",
    description:
      "A new time or ground releases its unconfirmed weeks and reserves the new time; confirmed weeks stay.",
  });

export const OrderRegulars = z
  .object({
    regularIds: z.array(z.uuid()).min(2).max(50).meta({
      description: "Regulars that overlap, first priority first. They swap their places in order.",
    }),
  })
  .meta({ id: "OrderRegulars" });

export type RegularStatus = z.infer<typeof RegularStatus>;
export type Reliability = z.infer<typeof Reliability>;
export type VenueRegular = z.infer<typeof VenueRegular>;
export type VenueRegularList = z.infer<typeof VenueRegularList>;
export type VenueRegularDetail = z.infer<typeof VenueRegularDetail>;
export type CreateRegular = z.infer<typeof CreateRegular>;
export type UpdateRegular = z.infer<typeof UpdateRegular>;
export type OrderRegulars = z.infer<typeof OrderRegulars>;
