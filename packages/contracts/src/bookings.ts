import { z } from "zod";
import { GroundSize, GroundSport, PriceTier } from "./grounds";
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

export const BookingChargeType = z.enum(["SLOT", "AMENITY", "DISCOUNT", "REWARD"]).meta({
  id: "BookingChargeType",
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

export const Booking = z
  .object({
    id: z.uuid(),
    code: z.string().meta({ description: "For the share link, /b/{code}." }),
    status: BookingStatus,
    startsAt: Instant,
    endsAt: Instant,
    expiresAt: Instant.nullable().meta({
      description: "`PENDING` and `HELD`: when it expires unless approved or paid.",
    }),
    venue: z.object({ id: z.uuid(), slug: z.string(), name: z.string().nullable() }),
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
    createdAt: Instant,
  })
  .meta({ id: "Booking" });

export type BookingStatus = z.infer<typeof BookingStatus>;
export type BookingRequest = z.infer<typeof BookingRequest>;
export type CreateBooking = z.infer<typeof CreateBooking>;
export type BookingCharge = z.infer<typeof BookingCharge>;
export type BookingQuote = z.infer<typeof BookingQuote>;
export type Booking = z.infer<typeof Booking>;
