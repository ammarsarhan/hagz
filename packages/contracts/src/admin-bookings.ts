import { z } from "zod";
import { BookingCharge, BookingStatus } from "./bookings";
import { GroundSize, GroundSport } from "./grounds";
import { PaymentStatus } from "./payments";
import { CancellationPolicy, CancellationTier, PaymentMode } from "./venue-edit";

// Bookings in the admin (Phase 4's admin slice): look up any booking, at any venue, with its
// payments and everything that happened to it.

const Instant = z.iso.datetime();

export const AdminBookingQuery = z
  .object({
    venueId: z.uuid().optional().meta({ description: "Only this venue's bookings." }),
    groundId: z.uuid().optional().meta({ description: "Only this ground's bookings." }),
    status: BookingStatus.optional(),
    date: z.iso.date().optional().meta({
      description: "Only bookings that start on this day, on the venue's calendar.",
      example: "2026-11-24",
    }),
    q: z.string().trim().max(100).optional().meta({
      description:
        "The booking's code, or part of the customer's name or phone, or the venue's name.",
    }),
    cursor: z.uuid().optional().meta({ description: "`nextCursor` from the previous page." }),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .meta({ id: "AdminBookingQuery" });

const Names = z.object({ en: z.string().nullable(), ar: z.string().nullable() });

export const BookingSource = z.enum(["APP", "STAFF"]).meta({
  id: "BookingSource",
  description: "`APP`: the player booked in the app. `STAFF`: entered by the venue's staff.",
});

export const AdminBooking = z
  .object({
    id: z.uuid(),
    code: z.string(),
    status: BookingStatus,
    startsAt: Instant,
    endsAt: Instant,
    timezone: z
      .string()
      .meta({ description: "The venue's IANA timezone.", example: "Africa/Cairo" }),
    venue: z.object({ id: z.uuid(), slug: z.string(), names: Names }),
    ground: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      sport: GroundSport,
      size: GroundSize,
    }),
    customer: z.object({ name: z.string(), phone: z.string().nullable() }),
    source: BookingSource,
    currency: z.string().meta({ example: "EGP" }),
    total: z.int().meta({ description: "Minor units, VAT included." }),
    createdAt: Instant,
  })
  .meta({ id: "AdminBooking" });

const Person = z.object({ id: z.uuid(), name: z.string() });

export const AdminBookingDetail = AdminBooking.extend({
  expiresAt: Instant.nullable(),
  updatedAt: Instant,
  note: z.string().nullable(),
  customer: z.object({
    venueCustomerId: z.uuid(),
    accountId: z
      .uuid()
      .nullable()
      .meta({ description: "The player's account; null for walk-ins." }),
    name: z.string(),
    phone: z.string().nullable(),
  }),
  creator: Person.nullable().meta({ description: "The staff member who entered it." }),
  regularId: z.uuid().nullable(),
  paymentMode: PaymentMode,
  deposit: z.int().nullable(),
  paid: z.int().meta({ description: "Succeeded payments less succeeded refunds." }),
  tax: z.int(),
  commissionRate: z.int().meta({ description: "Basis points, copied when it was made." }),
  cancellation: z.object({ policy: CancellationPolicy, tiers: z.array(CancellationTier) }),
  charges: z.array(
    BookingCharge.extend({ taxRate: z.int().meta({ description: "Basis points." }) }),
  ),
  cancelled: z
    .object({
      initiator: z.enum(["CUSTOMER", "VENUE", "ADMIN"]),
      reason: z.string().nullable(),
      refundPercent: z.int(),
      refundAmount: z.int(),
      at: Instant,
    })
    .nullable(),
  movedFrom: z
    .object({ bookingId: z.uuid(), code: z.string(), type: z.enum(["MOVE", "SWAP", "REFILL"]) })
    .nullable(),
  movedTo: z.array(
    z.object({ bookingId: z.uuid(), code: z.string(), type: z.enum(["MOVE", "SWAP", "REFILL"]) }),
  ),
}).meta({ id: "AdminBookingDetail" });

export const AdminRefund = z
  .object({
    id: z.uuid(),
    status: z.enum(["PENDING", "SUCCEEDED", "FAILED"]),
    amount: z.int(),
    reason: z.string().nullable(),
    providerReference: z.string().nullable(),
    succeededAt: Instant.nullable(),
    createdAt: Instant,
  })
  .meta({ id: "AdminRefund" });

export const AdminPayment = z
  .object({
    id: z.uuid(),
    method: z.enum(["CASH", "CARD", "WALLET", "REFERENCE", "BNPL"]),
    status: PaymentStatus,
    amount: z.int(),
    currency: z.string(),
    brand: z.string().nullable(),
    provider: z.string().nullable(),
    providerReference: z.string().nullable(),
    providerFee: z.int().nullable(),
    recorder: Person.nullable().meta({ description: "The staff member who recorded cash." }),
    succeededAt: Instant.nullable(),
    createdAt: Instant,
    refunds: z.array(AdminRefund),
  })
  .meta({ id: "AdminPayment" });

export const BookingActorKind = z
  .enum(["CUSTOMER", "STAFF", "ADMIN", "SYSTEM"])
  .meta({ id: "BookingActorKind" });

export const BookingHistoryEvent = z
  .object({
    id: z.uuid(),
    type: z.string().meta({ example: "CREATED" }),
    actor: z.object({
      kind: BookingActorKind,
      id: z.uuid().nullable(),
      name: z.string().nullable(),
    }),
    data: z.unknown().meta({ description: "The event's details as stored." }),
    createdAt: Instant,
  })
  .meta({ id: "BookingHistoryEvent" });

export const BookingHistoryQuery = z
  .object({
    cursor: z.uuid().optional().meta({ description: "`nextCursor` from the previous page." }),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .meta({ id: "BookingHistoryQuery" });

export type AdminBookingQuery = z.infer<typeof AdminBookingQuery>;
export type BookingSource = z.infer<typeof BookingSource>;
export type AdminBooking = z.infer<typeof AdminBooking>;
export type AdminBookingDetail = z.infer<typeof AdminBookingDetail>;
export type AdminRefund = z.infer<typeof AdminRefund>;
export type AdminPayment = z.infer<typeof AdminPayment>;
export type BookingHistoryEvent = z.infer<typeof BookingHistoryEvent>;
export type BookingHistoryQuery = z.infer<typeof BookingHistoryQuery>;
