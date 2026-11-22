import { z } from "zod";
import { AdminBooking, AdminBookingDetail } from "./admin-bookings";
import { BookingStatus } from "./bookings";
import { GroundSize, GroundSport } from "./grounds";

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
  expiresAt: Instant.nullable().meta({
    description: "`PENDING`, `HELD` and `UNCONFIRMED`: when it lets its slots go.",
  }),
  hold: z.boolean().meta({
    description: "A staff hold: `HELD` slots kept for someone deciding, with no payment due.",
  }),
}).meta({ id: "StaffBooking" });

export const StaffBookingList = z
  .object({ data: z.array(StaffBooking) })
  .meta({ id: "StaffBookingList" });

export const StaffBookingDetail = AdminBookingDetail.omit({ commissionRate: true })
  .extend({ hold: StaffBooking.shape.hold })
  .meta({ id: "StaffBookingDetail" });

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

// The share link (/b/{code}): what anyone with the link sees. No money and no customer.
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
    movedTo: z.string().nullable().meta({
      description:
        "`RESCHEDULED`: the code of the booking that replaced it, to follow the link there.",
    }),
  })
  .meta({ id: "SharedBooking" });

export type StaffBookingsQuery = z.infer<typeof StaffBookingsQuery>;
export type StaffBooking = z.infer<typeof StaffBooking>;
export type StaffBookingList = z.infer<typeof StaffBookingList>;
export type StaffBookingDetail = z.infer<typeof StaffBookingDetail>;
export type DeclineBooking = z.infer<typeof DeclineBooking>;
export type MarkBooking = z.infer<typeof MarkBooking>;
export type CreateHold = z.infer<typeof CreateHold>;
export type MoveBooking = z.infer<typeof MoveBooking>;
export type SwapBookings = z.infer<typeof SwapBookings>;
export type SwappedBookings = z.infer<typeof SwappedBookings>;
export type SharedBooking = z.infer<typeof SharedBooking>;
