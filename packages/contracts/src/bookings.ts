import { z } from "zod";
import { CheckInWindow } from "./check-in";
import { BookerListing, ListingRequest } from "./listings";
import { GroundSize, GroundSport, PriceTier } from "./grounds";
import { page } from "./lists";
import { Coordinates } from "./venue-setup";
import { AmenityPricing, CancellationPolicy, CancellationTier, PaymentMode } from "./venue-edit";

// Bookings (Phase 4): a run of back-to-back slots on one ground, booked by a player in the app or
// entered by staff. Its terms (prices, VAT, payment mode, commission, cancellation tiers) are copied
// when it's made and never change; a move makes a new booking (docs/rescheduling.md).

export const BookingStatus = z
  .enum([
    "PENDING",
    "HELD",
    "UNCONFIRMED",
    "CONFIRMED",
    "CANCELLED",
    "EXPIRED",
    "RELEASED",
    "RESCHEDULED",
    "COMPLETED",
    "NO_SHOW",
  ])
  .meta({
    id: "BookingStatus",
    description:
      "`PENDING`: waiting for the venue to approve, until `expiresAt`. `HELD`: waiting for payment, until `expiresAt`. `UNCONFIRMED`: a regular's weekly reservation waiting to be confirmed. `EXPIRED`: not approved or paid in time; its slots were released. `RELEASED`: a regular's reservation given up. `RESCHEDULED`: moved by the venue; a new booking replaced it.",
  });

export const BookingChargeType = z
  .enum(["SLOT", "AMENITY", "DISCOUNT", "REWARD", "ADJUSTMENT", "SERVICE_FEE"])
  .meta({
    id: "BookingChargeType",
    description:
      "`ADJUSTMENT`: the venue's own price for a booking its staff entered, as the difference from the other lines (either sign). `SERVICE_FEE`: Hagz's fee on an app booking (the ground's players × hours × the marketplace's rate); kept when the player cancels, collected by the venue and taken at payout.",
  });

const Instant = z.iso.datetime();

// What a player asks to book. The time must be whole slots, back to back, on one ground.
export const BookingRequest = z
  .object({
    groundId: z.uuid(),
    startsAt: Instant.meta({ description: "The first slot's start." }),
    endsAt: Instant.meta({ description: "The last slot's end." }),
    amenities: z
      .array(z.uuid())
      .max(20)
      .default([])
      .meta({ description: "Priced amenities (option ids) added to the booking." }),
  })
  .meta({ id: "BookingRequest" });

export const CreateBooking = BookingRequest.extend({
  note: z.string().trim().max(500).optional().meta({ description: "For the venue." }),
  listing: ListingRequest.optional().meta({
    description: "Ask for players: the open game starts once the booking is confirmed.",
  }),
}).meta({ id: "CreateBooking" });

export const BookingCharge = z
  .object({
    type: BookingChargeType,
    startsAt: Instant.nullable().meta({ description: "`SLOT`: the hour it charges." }),
    tier: PriceTier.nullable(),
    amenity: z
      .object({ id: z.uuid(), name: z.string().nullable(), pricing: AmenityPricing.nullable() })
      .nullable(),
    amount: z.int().meta({ description: "Minor units, VAT included." }),
    taxAmount: z.int().meta({ description: "The VAT inside `amount`." }),
  })
  .meta({ id: "BookingCharge" });

const Money = {
  currency: z
    .string()
    .meta({ description: "ISO 4217; amounts are in its minor units.", example: "EGP" }),
  total: z.int().meta({ description: "VAT included." }),
  tax: z.int().meta({ description: "The VAT inside `total`; 0 when the venue charges none." }),
  paymentMode: PaymentMode,
  deposit: z.int().nullable().meta({ description: "`DEPOSIT`: the share paid online." }),
};

// The price of a booking before it's made, for the review step. Prices can change until it's made.
export const BookingQuote = z
  .object({
    ...Money,
    startsAs: z.enum(["PENDING", "HELD", "CONFIRMED"]).meta({
      description:
        "What booking now would start as: waiting for approval, waiting for payment, or confirmed.",
    }),
    charges: z.array(BookingCharge),
  })
  .meta({ id: "BookingQuote" });

// A move staff made that the player hasn't answered yet (docs/rescheduling.md, "Rejecting a move").
export const BookingMove = z
  .object({
    type: z.enum(["MOVE", "SWAP"]),
    from: z.object({
      ground: z.object({ id: z.uuid(), name: z.string().nullable() }),
      startsAt: Instant,
      endsAt: Instant,
      total: z.int().meta({ description: "What it cost before the move." }),
    }),
    priceDifference: z.int().meta({ description: "New total less the old one, minor units." }),
    reason: z.string().nullable(),
    respondBy: Instant.meta({
      description: "24 hours after the move or kick-off, whichever is first. Silence accepts.",
    }),
    canMoveBack: z.boolean().meta({
      description: "The original time is still free (never after a swap).",
    }),
    movedAt: Instant,
  })
  .meta({ id: "BookingMove" });

// How a booking ended, when it did: who cancelled it (and whether that was the venue saying no
// while it waited for approval, with the reason given), or what ran out.
const Cancelled = z
  .object({
    by: z.enum(["CUSTOMER", "VENUE", "ADMIN"]),
    declined: z.boolean().meta({ description: "The venue said no while it waited for approval." }),
    reason: z
      .string()
      .nullable()
      .meta({ description: "What the venue or support said, if anything." }),
  })
  .nullable()
  .meta({ description: "`CANCELLED`: who did it." });
const ExpiredFrom = z.enum(["PENDING", "HELD"]).nullable().meta({
  description: "`EXPIRED`: what ran out, the venue's approval (`PENDING`) or payment (`HELD`).",
});

export const Booking = z
  .object({
    id: z.uuid(),
    code: z.string().meta({ description: "For the share link, /booking/{code}." }),
    status: BookingStatus,
    startsAt: Instant,
    endsAt: Instant,
    expiresAt: Instant.nullable().meta({
      description: "`PENDING` and `HELD`: when it expires unless approved or paid.",
    }),
    venue: z
      .object({
        id: z.uuid(),
        slug: z.string(),
        name: z.string().nullable(),
        timezone: z.string().meta({
          description: "The venue's IANA timezone, for showing times on its clock.",
          example: "Africa/Cairo",
        }),
        area: z.string().nullable().meta({ example: "Maadi, Cairo" }),
        address: z.string().nullable(),
        coordinates: Coordinates.nullable(),
        phone: z.string().nullable().meta({
          description: "E.164; the venue's number, for the player with a booking there.",
        }),
      })
      .meta({
        description:
          "Read with the booking, whatever the venue's status now: it can stop being public.",
      }),
    ground: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      sport: GroundSport,
      size: GroundSize,
    }),
    ...Money,
    paid: z.int().meta({
      description: "Paid online so far, in minor units: succeeded payments less refunds.",
    }),
    charges: z.array(BookingCharge),
    cancellation: z.object({ policy: CancellationPolicy, tiers: z.array(CancellationTier) }),
    note: z.string().nullable(),
    listing: BookerListing.nullable().meta({ description: "Its open game, if listed." }),
    checkIn: CheckInWindow.nullable().meta({
      description:
        "App bookings, once confirmed: when to show the check-in code at the venue, and whether they did.",
    }),
    move: BookingMove.nullable().meta({
      description:
        "The venue moved this booking and the player can still answer: accept, reject for a full refund, or move it back. Null otherwise.",
    }),
    cancelled: Cancelled,
    expiredFrom: ExpiredFrom,
    createdAt: Instant,
  })
  .meta({ id: "Booking" });

// A player's bookings, as the Bookings tab lists them. Upcoming: still to be played (waiting or
// confirmed), soonest first. Past: played, or ended without being played (cancelled, expired,
// released), latest first. A booking the venue moved isn't listed; the booking that replaced it is.
export const BookingsQuery = z
  .object({
    when: z.enum(["upcoming", "past"]).default("upcoming"),
    cursor: z.string().optional().meta({ description: "`nextCursor` from the previous page." }),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .meta({ id: "BookingsQuery" });

export const BookingSummary = z
  .object({
    id: z.uuid(),
    code: z.string(),
    status: BookingStatus,
    startsAt: Instant,
    endsAt: Instant,
    expiresAt: Instant.nullable(),
    venue: z.object({
      id: z.uuid(),
      slug: z.string(),
      name: z.string().nullable(),
      area: z.string().nullable().meta({ example: "Maadi, Cairo" }),
      cover: z.object({ url: z.string() }).nullable(),
      timezone: z.string().meta({
        description: "The venue's IANA timezone, for showing times on its clock.",
        example: "Africa/Cairo",
      }),
    }),
    ground: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      sport: GroundSport,
      size: GroundSize,
    }),
    currency: z.string().meta({ example: "EGP" }),
    total: z.int().meta({ description: "Minor units, VAT included." }),
    paymentMode: PaymentMode,
    checkIn: CheckInWindow.nullable().meta({
      description: "App bookings, once confirmed: when check-in opens, and whether they did.",
    }),
    move: z.object({ respondBy: Instant }).nullable().meta({
      description: "The venue moved it and the player can still answer, until respondBy.",
    }),
    cancellation: Cancelled,
    expiredFrom: ExpiredFrom,
  })
  .meta({ id: "BookingSummary" });

export const BookingPage = page(BookingSummary);

export type BookingStatus = z.infer<typeof BookingStatus>;
export type BookingRequest = z.infer<typeof BookingRequest>;
export type CreateBooking = z.infer<typeof CreateBooking>;
export type BookingCharge = z.infer<typeof BookingCharge>;
export type BookingQuote = z.infer<typeof BookingQuote>;
export type BookingMove = z.infer<typeof BookingMove>;
export type Booking = z.infer<typeof Booking>;
export type BookingsQuery = z.infer<typeof BookingsQuery>;
export type BookingSummary = z.infer<typeof BookingSummary>;
export type BookingPage = z.infer<typeof BookingPage>;
