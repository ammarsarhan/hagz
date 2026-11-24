import type {
  AdminBooking,
  AdminBookingDetail,
  AdminBookingQuery,
  BookingHistoryEvent,
  BookingHistoryQuery,
  BookingStatus,
  CancellationTier,
} from "@hagz/contracts";
import { BookingStatus as BookingStatuses } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import { bookingNotFound } from "./booking-rows";

// Bookings in the admin (Phase 4's admin slice): any booking at any venue, newest made first (ids
// are uuid v7, so id order is creation order), a page at a time; one booking in full; and its
// events.

const STATUSES = BookingStatuses.options;

// Prisma escapes nothing in `contains`, so % and _ would act as wildcards.
const literal = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

const names = { translations: { select: { language: true, name: true } } } as const;

const namesOf = (translations: { language: string; name: string }[]) => ({
  en: translations.find((t) => t.language === "EN")?.name ?? null,
  ar: translations.find((t) => t.language === "AR")?.name ?? null,
});

export const groundName = (translations: { language: string; name: string }[]) => {
  const { en, ar } = namesOf(translations);
  return en ?? ar;
};

export const summarySelect = {
  id: true,
  code: true,
  status: true,
  startsAt: true,
  endsAt: true,
  total: true,
  creatorId: true,
  createdAt: true,
  venue: {
    select: {
      id: true,
      slug: true,
      ...names,
      marketplace: { select: { currency: true, timezone: true } },
    },
  },
  ground: { select: { id: true, sport: true, size: true, ...names } },
  customer: { select: { name: true, phone: true } },
} as const satisfies Prisma.BookingSelect;

export type SummaryRow = Prisma.BookingGetPayload<{ select: typeof summarySelect }>;

export const presentSummary = (booking: SummaryRow): AdminBooking => ({
  id: booking.id,
  code: booking.code,
  status: booking.status,
  startsAt: booking.startsAt.toISOString(),
  endsAt: booking.endsAt.toISOString(),
  timezone: booking.venue.marketplace.timezone,
  venue: {
    id: booking.venue.id,
    slug: booking.venue.slug,
    names: namesOf(booking.venue.translations),
  },
  ground: {
    id: booking.ground.id,
    name: groundName(booking.ground.translations),
    sport: booking.ground.sport,
    size: booking.ground.size,
  },
  customer: { name: booking.customer.name, phone: booking.customer.phone },
  source: booking.creatorId ? "STAFF" : "APP",
  currency: booking.venue.marketplace.currency,
  total: booking.total,
  createdAt: booking.createdAt.toISOString(),
});

// Bookings starting on a day on their venue's calendar: that day's midnight to the next in each
// marketplace's timezone (Postgres does the zone, summer time included).
const dayIn = async (date: string): Promise<Prisma.BookingWhereInput> => {
  const days = await prisma.$queryRaw<{ id: string; from: Date; to: Date }[]>`
    SELECT id,
           (${date}::date)::timestamp AT TIME ZONE timezone AS "from",
           (${date}::date + 1)::timestamp AT TIME ZONE timezone AS "to"
    FROM "Marketplace"`;
  return {
    OR: days.map((day) => ({
      venue: { marketplaceId: day.id },
      startsAt: { gte: day.from, lt: day.to },
    })),
  };
};

export const listAdminBookings = async ({
  venueId,
  groundId,
  status,
  date,
  q,
  cursor,
  limit,
}: AdminBookingQuery) => {
  const text = q ? literal(q) : null;
  const day = date ? await dayIn(date) : null;
  // The venue and ground (a venue's Bookings tab) and the search narrow the counts too; the tab
  // doesn't.
  const search: Prisma.BookingWhereInput = {
    ...(venueId && { venueId }),
    ...(groundId && { groundId }),
    ...(day && { AND: [day] }),
    ...(text && {
      OR: [
        // Codes are upper case; people type them any way.
        { code: { contains: text.toUpperCase() } },
        { customer: { name: { contains: text, mode: "insensitive" } } },
        { customer: { phone: { contains: text.replace(/\s/g, "") } } },
        {
          venue: {
            translations: { some: { name: { contains: text, mode: "insensitive" } } },
          },
        },
      ],
    }),
  };

  const [rows, groups] = await Promise.all([
    prisma.booking.findMany({
      where: { ...search, ...(status && { status }), ...(cursor && { id: { lt: cursor } }) },
      orderBy: { id: "desc" },
      take: limit + 1,
      select: summarySelect,
    }),
    // For the status tabs: how many match the search in each status.
    prisma.booking.groupBy({ by: ["status"], where: search, _count: true }),
  ]);

  const more = rows.length > limit;
  const data = (more ? rows.slice(0, limit) : rows).map(presentSummary);
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, groups.find((g) => g.status === s)?._count ?? 0]),
  ) as Record<BookingStatus, number>;
  return { data, nextCursor: more ? (data.at(-1)?.id ?? null) : null, counts };
};

export const adminBookingDetail = async (bookingId: string): Promise<AdminBookingDetail> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      ...summarySelect,
      expiresAt: true,
      updatedAt: true,
      note: true,
      regularId: true,
      paymentMode: true,
      depositAmount: true,
      commissionRate: true,
      cancellationPolicy: true,
      cancellationTiers: true,
      customer: { select: { id: true, customerId: true, name: true, phone: true } },
      creator: { select: { id: true, name: true } },
      charges: {
        orderBy: [{ type: "asc" }, { startsAt: "asc" }, { id: "asc" }],
        select: {
          type: true,
          startsAt: true,
          tier: true,
          optionId: true,
          pricing: true,
          amount: true,
          taxRate: true,
          taxAmount: true,
          option: { select: names },
        },
      },
      payments: {
        where: { status: "SUCCEEDED" },
        select: {
          amount: true,
          refunds: { where: { status: "SUCCEEDED" }, select: { amount: true } },
        },
      },
      cancellation: true,
      rescheduledFrom: { select: { type: true, from: { select: { id: true, code: true } } } },
      rescheduledTo: { select: { type: true, to: { select: { id: true, code: true } } } },
    },
  });
  if (!booking) throw bookingNotFound();

  return {
    ...presentSummary(booking),
    customer: {
      venueCustomerId: booking.customer.id,
      accountId: booking.customer.customerId,
      name: booking.customer.name,
      phone: booking.customer.phone,
    },
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    updatedAt: booking.updatedAt.toISOString(),
    note: booking.note,
    creator: booking.creator,
    regularId: booking.regularId,
    paymentMode: booking.paymentMode,
    deposit: booking.depositAmount,
    paid: booking.payments.reduce(
      (sum, payment) =>
        sum + payment.amount - payment.refunds.reduce((total, refund) => total + refund.amount, 0),
      0,
    ),
    tax: booking.charges.reduce((sum, charge) => sum + charge.taxAmount, 0),
    commissionRate: booking.commissionRate,
    cancellation: {
      policy: booking.cancellationPolicy,
      tiers: booking.cancellationTiers as CancellationTier[],
    },
    charges: booking.charges.map((charge) => ({
      type: charge.type,
      startsAt: charge.startsAt?.toISOString() ?? null,
      tier: charge.tier,
      amenity: charge.optionId
        ? {
            id: charge.optionId,
            name: charge.option ? groundName(charge.option.translations) : null,
            pricing: charge.pricing,
          }
        : null,
      amount: charge.amount,
      taxRate: charge.taxRate,
      taxAmount: charge.taxAmount,
    })),
    cancelled: booking.cancellation
      ? {
          initiator: booking.cancellation.initiator,
          reason: booking.cancellation.reason,
          refundPercent: booking.cancellation.refundPercent,
          refundAmount: booking.cancellation.refundAmount,
          at: booking.cancellation.createdAt.toISOString(),
        }
      : null,
    movedFrom: booking.rescheduledFrom
      ? {
          bookingId: booking.rescheduledFrom.from.id,
          code: booking.rescheduledFrom.from.code,
          type: booking.rescheduledFrom.type,
        }
      : null,
    movedTo: booking.rescheduledTo.map((move) => ({
      bookingId: move.to.id,
      code: move.to.code,
      type: move.type,
    })),
  };
};

// Everything that happened to a booking, newest first, a page at a time. An event names at most one
// actor (a CHECK); none means the system (the expiry sweep, a payment).
export const bookingHistory = async (
  bookingId: string,
  { cursor, limit }: BookingHistoryQuery,
): Promise<{ data: BookingHistoryEvent[]; nextCursor: string | null }> => {
  const exists = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true },
  });
  if (!exists) throw bookingNotFound();
  const rows = await prisma.bookingEvent.findMany({
    where: { bookingId, ...(cursor && { id: { lt: cursor } }) },
    orderBy: { id: "desc" },
    take: limit + 1,
    select: {
      id: true,
      type: true,
      data: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      staff: { select: { id: true, name: true } },
      admin: { select: { id: true, name: true } },
    },
  });
  const more = rows.length > limit;
  const data = (more ? rows.slice(0, limit) : rows).map((event) => {
    const [kind, person] = event.customer
      ? (["CUSTOMER", event.customer] as const)
      : event.staff
        ? (["STAFF", event.staff] as const)
        : event.admin
          ? (["ADMIN", event.admin] as const)
          : (["SYSTEM", null] as const);
    return {
      id: event.id,
      type: event.type,
      actor: { kind, id: person?.id ?? null, name: person?.name ?? null },
      data: event.data,
      createdAt: event.createdAt.toISOString(),
    };
  });
  return { data, nextCursor: more ? (data.at(-1)?.id ?? null) : null };
};
