import { z } from "zod";
import { AdminBooking, AdminBookingDetail } from "./admin-bookings";
import { BookingStatus } from "./bookings";
import { GroundSize, GroundSport } from "./grounds";
import { StaffCheckIn } from "./check-in";
import { StaffGame } from "./listings";
import { PaymentMode } from "./venue-edit";

// A venue's bookings for its staff (Phase 4): the calendar and the approvals queue (PR 4.4),
// approving, declining and marking how a game went (PR 4.2), and holds, moves and swaps (PR 4.8,
// docs/rescheduling.md).

const Instant = z.iso.datetime();
const LocalDate = z.iso
  .date()
  .meta({ description: "A calendar day in the venue's timezone.", example: "2026-12-01" });

export const StaffBookingsQuery = z
  .object({
    date: LocalDate,
    span: z.coerce.number().int().min(1).max(7).default(1).meta({
      description: "How many days to read from the date, up to a week.",
    }),
    groundId: z.uuid().optional().meta({ description: "Only this ground's bookings." }),
    status: BookingStatus.optional().meta({
      description:
        "Only bookings in this status. Left out: the ones holding their slots (waiting, confirmed, played or no-show).",
    }),
  })
  .meta({ id: "StaffBookingsQuery" });

export const StaffBooking = AdminBooking.extend({
  venueCustomerId: z.uuid().meta({
    description:
      "Who it's for, as the venue's customer (a regular's own bookings are found by it).",
  }),
  expiresAt: Instant.nullable().meta({
    description: "`PENDING`, `HELD` and `UNCONFIRMED`: when it lets its slots go.",
  }),
  hold: z.boolean().meta({
    description: "A staff hold: `HELD` slots kept for someone deciding, with no payment due.",
  }),
  regular: z.boolean().meta({
    description: "One week of a regular's weekly game (`UNCONFIRMED` until it's confirmed).",
  }),
  openGame: z
    .object({ players: z.int() })
    .nullable()
    .meta({ description: "An open game: how many players to expect besides the booker." }),
  paymentMode: PaymentMode,
  deposit: z.int().nullable().meta({ description: "`DEPOSIT`: the share paid online." }),
  paymentWindow: z.int().nullable().meta({
    description:
      "`PENDING` with something to pay online: the minutes the player would have to pay if it were approved now (the venue's payment window, never past kick-off). Null otherwise.",
  }),
}).meta({ id: "StaffBooking" });

export const StaffBookingList = z
  .object({ data: z.array(StaffBooking) })
  .meta({ id: "StaffBookingList" });

export const StaffBookingDetail = AdminBookingDetail.omit({ commissionRate: true })
  .extend({
    hold: StaffBooking.shape.hold,
    game: StaffGame.nullable(),
    checkIn: StaffCheckIn.nullable().meta({
      description: "App bookings: who has checked in (the booker and any joined players).",
    }),
  })
  .meta({ id: "StaffBookingDetail" });

// The Home tab (Figma D21c 739:2): what needs the staff member on a day, then what's next and what's
// still free. Counts carry the one booking when there's exactly one, so a card can open it.
export const StaffHomeQuery = z
  .object({ date: LocalDate.meta({ description: "Today or a later day, venue-local." }) })
  .meta({ id: "StaffHomeQuery" });

const Waiting = z.object({
  count: z.int().min(0),
  soonest: Instant.nullable().meta({ description: "When the first of them runs out." }),
  bookingId: z.uuid().nullable().meta({ description: "The booking, when there's just one." }),
});

export const StaffHome = z
  .object({
    timezone: z
      .string()
      .meta({ description: "The venue's IANA timezone.", example: "Africa/Cairo" }),
    requests: Waiting.meta({
      description: "Waiting for approval: all of them for today, that day's for a later one.",
    }),
    holds: Waiting.meta({ description: "Staff holds on the day, still held." }),
    toMark: Waiting.meta({
      description:
        "Today only: games that ended without a check-in, still open to marking as a no-show.",
    }),
    weeks: Waiting.meta({ description: "Regulars' weeks on the day still to confirm." }),
    cash: z.object({ amount: z.int(), count: z.int(), currency: z.string() }).nullable().meta({
      description:
        "Money still to take at the venue for the day's games not yet checked in or over (minor units). Null without `payments: view`.",
    }),
    games: z
      .object({
        count: z.int().min(0),
        next: Instant.nullable().meta({
          description:
            "Today: the next game's start, null when none is left. A later day: its first.",
        }),
      })
      .meta({ description: "The day's games: confirmed, still to confirm, played or no-show." }),
    booked: z.object({ booked: z.int().min(0), open: z.int().min(0) }).meta({
      description:
        "The day's hours on live grounds: how many are booked or held, of all not closed by staff.",
    }),
    checkIns: z
      .object({ checkedIn: z.int().min(0), started: z.int().min(0) })
      .nullable()
      .meta({
        description:
          "Today only: of the app games that have kicked off, how many have checked in. Null on a later day.",
      }),
    takings: z.object({ amount: z.int(), currency: z.string() }).nullable().meta({
      description:
        "What the day's games come to, however they're paid (minor units). Null without `payments: view`.",
    }),
    next: z.array(StaffBooking.extend({ checkedIn: z.boolean() })).meta({
      description: "Up to three games yet to end, from the day's start (today: from now).",
    }),
    free: z
      .array(
        z.object({
          groundId: z.uuid(),
          groundName: z.string().nullable(),
          slotIds: z.array(z.uuid()).meta({ description: "The run's slots, in time order." }),
          startsAt: Instant,
          endsAt: Instant,
          price: z.int().meta({ description: "The first hour's price, minor units." }),
          currency: z.string(),
        }),
      )
      .meta({
        description:
          "Up to three runs of open hours on the day, soonest first, each cut to a game the ground " +
          "allows (6–12 at 3 hours at most: 6–9 and 9–12).",
      }),
  })
  .meta({ id: "StaffHome" });

const Reason = z.string().trim().min(1).max(500);

export const DeclineBooking = z
  .object({ reason: Reason.optional().meta({ description: "Shown to the player." }) })
  .meta({ id: "DeclineBooking" });

export const MarkBooking = z
  .object({
    outcome: z.enum(["COMPLETED", "NO_SHOW"]).meta({
      description: "Played, or the customer didn't come. Either can be corrected to the other.",
    }),
  })
  .meta({ id: "MarkBooking" });

const Range = {
  groundId: z.uuid(),
  startsAt: Instant.meta({ description: "The first slot's start." }),
  endsAt: Instant.meta({ description: "The last slot's end." }),
};

export const CreateHold = z
  .object({
    ...Range,
    customer: z
      .union([
        z.object({ venueCustomerId: z.uuid() }),
        z.object({
          name: z.string().trim().min(1).max(100),
          phone: z.string().min(1).max(32).meta({ example: "+20 100 123 4567" }),
        }),
      ])
      .meta({
        description:
          "Who it's held for: one of the venue's customers, or someone new by name and mobile number (found by number if the venue knows them).",
      }),
  })
  .meta({ id: "CreateHold" });

export const MoveBooking = z
  .object({
    ...Range,
    holdId: z.uuid().optional().meta({
      description:
        "The staff hold on the target time, made when it was picked. Released by the move in the same step.",
    }),
    reason: Reason.optional(),
  })
  .meta({ id: "MoveBooking" });

export const SwapBookings = z
  .object({
    withBookingId: z.uuid().meta({ description: "The booking that takes this one's time." }),
    reason: Reason.optional(),
  })
  .meta({ id: "SwapBookings" });

export const SwappedBookings = z
  .object({
    data: z.tuple([StaffBookingDetail, StaffBookingDetail]).meta({
      description: "The two new bookings: this one's, then the other's.",
    }),
  })
  .meta({ id: "SwappedBookings" });

// The share link (/booking/{code}): what anyone with the link sees. No money and no customer.
export const SharedBooking = z
  .object({
    code: z.string(),
    status: BookingStatus,
    startsAt: Instant,
    endsAt: Instant,
    timezone: z.string().meta({ example: "Africa/Cairo" }),
    venue: z.object({
      id: z.uuid(),
      slug: z.string(),
      name: z.string().nullable(),
      area: z.string().nullable().meta({ example: "Maadi, Cairo" }),
    }),
    ground: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      sport: GroundSport,
      size: GroundSize,
    }),
    gameId: z.uuid().nullable().meta({
      description: "An open game anyone can join from the link: `GET /v1/games/{id}`.",
    }),
    movedTo: z.string().nullable().meta({
      description:
        "`RESCHEDULED`: the code of the booking that replaced it, to follow the link there.",
    }),
    yours: z.uuid().nullable().meta({
      description:
        "The booking's id when the signed-in player booked it (the app opens their own page); else null.",
    }),
  })
  .meta({ id: "SharedBooking" });

export type StaffBookingsQuery = z.infer<typeof StaffBookingsQuery>;
export type StaffBooking = z.infer<typeof StaffBooking>;
export type StaffBookingList = z.infer<typeof StaffBookingList>;
export type StaffHomeQuery = z.infer<typeof StaffHomeQuery>;
export type StaffHome = z.infer<typeof StaffHome>;
export type StaffBookingDetail = z.infer<typeof StaffBookingDetail>;
export type DeclineBooking = z.infer<typeof DeclineBooking>;
export type MarkBooking = z.infer<typeof MarkBooking>;
export type CreateHold = z.infer<typeof CreateHold>;
export type MoveBooking = z.infer<typeof MoveBooking>;
export type SwapBookings = z.infer<typeof SwapBookings>;
export type SwappedBookings = z.infer<typeof SwappedBookings>;
export type SharedBooking = z.infer<typeof SharedBooking>;

// The venue's customers (PR 4.3): app players who booked there and walk-ins staff entered.

const Phone = z.string().min(1).max(32).meta({ example: "+20 100 123 4567" });
const Name = z.string().trim().min(1).max(100);
const Note = z.string().trim().max(500).meta({
  description: "Staff's own note about the customer; never shown to them. Empty clears it.",
});

export const VenueCustomersQuery = z
  .object({
    q: z.string().trim().max(100).optional().meta({
      description: "Part of the name or the phone number.",
    }),
    order: z.enum(["name", "recent"]).default("name").meta({
      description:
        "`name`: A to Z, paged. `recent`: who played last first, then who was added last (one page, for picking someone quickly).",
    }),
    cursor: z.string().optional().meta({ description: "`nextCursor` from the previous page." }),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((query) => !(query.order === "recent" && query.cursor), {
    message: "`recent` is one page; it takes no cursor.",
    path: ["cursor"],
  })
  .meta({ id: "VenueCustomersQuery" });

export const VenueCustomer = z
  .object({
    id: z.uuid(),
    name: z.string(),
    phone: z.string().nullable(),
    app: z.boolean().meta({
      description:
        "A Hagz account: its name and number follow the account and can't be edited by the venue.",
    }),
    note: z.string().nullable(),
    lastBookedAt: Instant.nullable(),
    bookingCount: z.int().meta({ description: "Games played (completed)." }),
    noShowCount: z.int(),
    createdAt: Instant,
  })
  .meta({ id: "VenueCustomer" });

export const VenueCustomerPage = z
  .object({
    data: z.array(VenueCustomer),
    nextCursor: z.string().nullable(),
    total: z.int().meta({
      description: "How many customers match `q` (all of them without one), across every page.",
    }),
  })
  .meta({ id: "VenueCustomerPage" });

export const CreateVenueCustomer = z
  .object({ name: Name, phone: Phone.optional(), note: Note.optional() })
  .meta({ id: "CreateVenueCustomer" });

export const UpdateVenueCustomer = z
  .object({
    name: Name.optional().meta({ description: "Walk-ins only." }),
    phone: Phone.nullable().optional().meta({ description: "Walk-ins only; null removes it." }),
    note: Note.optional(),
  })
  .meta({ id: "UpdateVenueCustomer" });

export const CustomerBookingsQuery = z
  .object({
    cursor: z.uuid().optional().meta({ description: "`nextCursor` from the previous page." }),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .meta({ id: "CustomerBookingsQuery" });

export const StaffBookingPage = z
  .object({ data: z.array(StaffBooking), nextCursor: z.uuid().nullable() })
  .meta({ id: "StaffBookingPage" });

// A walk-in or phone booking (PR 4.3): confirmed at once, paid at the venue, no commission.
export const CreateStaffBooking = z
  .object({
    ...Range,
    amenities: z
      .array(z.uuid())
      .max(20)
      .default([])
      .meta({ description: "Priced amenities (option ids) added to the booking." }),
    customer: CreateHold.shape.customer,
    total: z.int().min(0).optional().meta({
      description:
        "The venue's own price, in minor units, VAT included. Left out: the slots' and amenities' prices. Kept as an `ADJUSTMENT` line for the difference.",
    }),
    note: z.string().trim().max(500).optional(),
  })
  .meta({ id: "CreateStaffBooking" });

export type VenueCustomersQuery = z.infer<typeof VenueCustomersQuery>;
export type VenueCustomer = z.infer<typeof VenueCustomer>;
export type VenueCustomerPage = z.infer<typeof VenueCustomerPage>;
export type CreateVenueCustomer = z.infer<typeof CreateVenueCustomer>;
export type UpdateVenueCustomer = z.infer<typeof UpdateVenueCustomer>;
export type CustomerBookingsQuery = z.infer<typeof CustomerBookingsQuery>;
export type StaffBookingPage = z.infer<typeof StaffBookingPage>;
export type CreateStaffBooking = z.infer<typeof CreateStaffBooking>;
