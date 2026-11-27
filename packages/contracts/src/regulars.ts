import { z } from "zod";
import { GroundSize, GroundSport } from "./grounds";
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
    ground: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      deleted: z.boolean().meta({
        description: "Staff deleted it: the regular ends after its last confirmed week.",
      }),
    }),
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
  comingWeeks: z
    .array(
      z.object({
        date: LocalDate,
        state: z.enum(["CONFIRMED", "WAITING", "LET_GO", "NOT_ANSWERED"]),
      }),
    )
    .meta({
      description:
        "Its weeks still to come, soonest first: confirmed (moved ones too), waiting for a confirm, let go by the regular or staff, or not answered by the deadline. Weeks let go because its time changed aren't listed.",
    }),
  lastWeeks: z
    .array(
      z.object({
        date: LocalDate,
        outcome: z.enum(["PLAYED", "NO_SHOW", "LET_GO", "NOT_ANSWERED"]),
      }),
    )
    .meta({
      description:
        "Its last 10 settled weeks, oldest first: played, a no-show, let go in time (or cancelled after confirming), or not answered by the deadline. Weeks released because the regular changed aren't counted.",
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

// Fill a slot (PR 4.6, docs/regulars.md "Filling a slot from the venue's own customers"): who to call
// about an empty slot, worked out from the venue's thresholds whenever it's asked for.

export const CandidateGroup = z.enum(["LAPSED_REGULAR", "ACTIVE_REGULAR", "OTHER"]).meta({
  id: "CandidateGroup",
  description:
    "In priority order. A regular has a standing weekly time here, or played `regularBookings` games in the last `regularPeriod` weeks; lapsed when they haven't played for `lapsedAfter` weeks.",
});

const SlotRef = z.object({
  id: z.uuid(),
  groundId: z.uuid(),
  startsAt: Instant,
  endsAt: Instant,
});

export const SlotCandidate = z
  .object({
    customer: VenueRegular.shape.customer,
    group: CandidateGroup,
    standing: z.boolean().meta({ description: "Has an active weekly time here." }),
    gamesPlayed: z.int(),
    noShows: z.int(),
    lastPlayedAt: Instant.nullable(),
    usual: z
      .object({ dayOfWeek: Time.dayOfWeek, hour: Time.startHour })
      .nullable()
      .meta({ description: "The weekday and hour they've played most, in the venue's time." }),
    suggestedSlot: SlotRef.nullable().meta({
      description:
        "Active regulars: another free slot in the next 7 days near their usual time, to offer as well.",
    }),
  })
  .meta({ id: "SlotCandidate" });

export const SlotCandidatesQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(30) })
  .meta({ id: "SlotCandidatesQuery" });

export const SlotCandidates = z
  .object({
    slot: SlotRef.extend({
      status: z.enum(["AVAILABLE", "HELD", "BOOKED", "BLOCKED"]).meta({
        description: "It may have been taken since the list was asked for.",
      }),
    }),
    data: z.array(SlotCandidate).meta({
      description:
        "Best first: by group, then how well the slot fits them (weekday, hour, ground, sport), fewer no-shows, and who played last. Anyone already booked at that time is left out.",
    }),
  })
  .meta({ id: "SlotCandidates" });

// A confirm link (docs/regulars.md "Reminders"): staff copy one for a waiting week and send it from
// their own WhatsApp; the regular opens it on the web and confirms or lets the week go without
// signing in.
export const ConfirmLink = z
  .object({
    url: z.url().meta({ description: "Works once, until the week's deadline." }),
    expiresAt: Instant.meta({ description: "The week's deadline." }),
  })
  .meta({ id: "ConfirmLink" });

export const ReminderTokenBody = z
  .object({ token: z.string().min(20).max(200) })
  .meta({ id: "ReminderTokenBody", description: "The token from the link's #token=." });

export const ReminderWeek = z
  .object({
    state: z.enum(["WAITING", "CONFIRMED", "RELEASED", "MISSED", "MOVED", "CHANGED"]).meta({
      description:
        "WAITING: can be confirmed or let go. CONFIRMED: playing (said by the regular or staff). RELEASED: the regular let it go. MISSED: nobody confirmed by the deadline, so it went back on sale. MOVED: the venue moved or swapped it; `movedTo` is where it is now. CHANGED: the venue let it go or cancelled it, or paused or ended the regular.",
    }),
    code: z.string().meta({
      description: "The week's booking code, for the regular to quote to the venue.",
      example: "K7Q2P9M4",
    }),
    name: z.string().meta({ description: "The regular's first name." }),
    venue: z.object({
      name: z.string().nullable(),
      slug: z.string(),
      area: z.string().nullable().meta({ example: "Maadi, Cairo" }),
    }),
    ground: z.object({ name: z.string().nullable(), sport: GroundSport, size: GroundSize }),
    startsAt: Instant,
    endsAt: Instant,
    deadline: Instant.nullable(),
    timezone: z.string(),
    movedTo: z
      .object({
        code: z.string(),
        ground: z.object({ name: z.string().nullable() }),
        startsAt: Instant,
        endsAt: Instant,
      })
      .nullable()
      .meta({ description: "MOVED: the week where it is now, after every move. Null otherwise." }),
  })
  .meta({ id: "ReminderWeek" });

export type ConfirmLink = z.infer<typeof ConfirmLink>;
export type ReminderTokenBody = z.infer<typeof ReminderTokenBody>;
export type ReminderWeek = z.infer<typeof ReminderWeek>;
export type RegularStatus = z.infer<typeof RegularStatus>;
export type Reliability = z.infer<typeof Reliability>;
export type VenueRegular = z.infer<typeof VenueRegular>;
export type VenueRegularList = z.infer<typeof VenueRegularList>;
export type VenueRegularDetail = z.infer<typeof VenueRegularDetail>;
export type CreateRegular = z.infer<typeof CreateRegular>;
export type UpdateRegular = z.infer<typeof UpdateRegular>;
export type OrderRegulars = z.infer<typeof OrderRegulars>;
export type CandidateGroup = z.infer<typeof CandidateGroup>;
export type SlotCandidate = z.infer<typeof SlotCandidate>;
export type SlotCandidatesQuery = z.infer<typeof SlotCandidatesQuery>;
export type SlotCandidates = z.infer<typeof SlotCandidates>;
