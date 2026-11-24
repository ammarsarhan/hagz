import type { Checkout, StartCheckout } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { createIdempotently } from "@/platform/idempotency/idempotency";
import type { PaymentProvider } from "@/platform/payments/payment-provider";
import { payments, paymentsUnavailable } from "@/platform/payments/payments";

// A player pays for a HELD booking (Phase 4 stub; the real provider is Phase 5). The Payment row is
// written first, PENDING, so the provider gets its id as the merchant reference and a retried call
// can't charge twice; the provider is called after the commit, never inside a transaction.

const IDEMPOTENCY_INDEX = "Payment_bookingId_idempotencyKey_key";

export const bookingNotFound = () =>
  new AppError({
    code: "BOOKING_NOT_FOUND",
    status: 404,
    detail: "No booking of yours with that id.",
  });

const holdExpired = () =>
  new AppError({
    code: "HOLD_EXPIRED",
    status: 409,
    detail: "The time to pay for this booking ran out, and its slots were let go.",
  });

const notAwaitingPayment = (status: string) =>
  new AppError({
    code: "BOOKING_NOT_AWAITING_PAYMENT",
    status: 409,
    detail: "This booking has nothing to pay online right now.",
    extensions: { bookingStatus: status },
  });

export const startCheckout = async (
  customerId: string,
  bookingId: string,
  input: StartCheckout,
  idempotencyKey: string,
  clock: Clock = systemClock,
  provider: PaymentProvider = payments,
): Promise<{ checkout: Checkout; replayed: boolean }> => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customer: { customerId } },
    select: {
      id: true,
      code: true,
      status: true,
      expiresAt: true,
      total: true,
      depositAmount: true,
      venue: { select: { marketplace: { select: { currency: true } } } },
    },
  });
  if (!booking) throw bookingNotFound();
  const now = clock.now();
  if (booking.status === "EXPIRED") throw holdExpired();
  if (booking.status !== "HELD") throw notAwaitingPayment(booking.status);
  if (!booking.expiresAt || booking.expiresAt <= now) throw holdExpired();
  if (!provider.configured) throw paymentsUnavailable();

  const amount = booking.depositAmount ?? booking.total;
  const currency = booking.venue.marketplace.currency;

  const select = { id: true, status: true, method: true, amount: true } as const;
  const result = await createIdempotently({
    index: IDEMPOTENCY_INDEX,
    find: () =>
      prisma.payment.findUnique({
        where: { bookingId_idempotencyKey: { bookingId, idempotencyKey } },
        select,
      }),
    matches: (existing) => existing.method === input.method,
    create: () =>
      transaction(async (tx) => {
        // One checkout at a time: a newer one replaces any still waiting.
        await tx.payment.updateMany({
          where: { bookingId, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        return tx.payment.create({
          data: {
            bookingId,
            method: input.method,
            status: "PENDING",
            amount,
            provider: provider.name,
            idempotencyKey,
          },
          select,
        });
      }),
  });

  const payment = result.value;
  // On a retry the provider is asked again with the same payment id, which it treats as the same
  // payment. (The stand-in's answer is the same every time; Phase 5 decides whether to keep the
  // provider's session instead.)
  const session = await provider.createCheckout({
    paymentId: payment.id,
    amount: payment.amount,
    currency,
    method: input.method,
    description: `Hagz booking ${booking.code}`,
  });
  await prisma.payment.updateMany({
    where: { id: payment.id, providerReference: null },
    data: { providerReference: session.reference },
  });

  return {
    checkout: {
      payment: {
        id: payment.id,
        status: payment.status,
        method: input.method,
        amount: payment.amount,
        currency,
      },
      provider: provider.name,
      reference: session.reference,
      url: session.url,
    },
    replayed: result.replayed,
  };
};
