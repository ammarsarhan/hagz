import type { AdminPayment } from "@hagz/contracts";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";

// A booking's payments for the admin, oldest first, each with its refunds: every checkout, including
// the ones that failed or were replaced, so support can see what the player went through.
export const adminBookingPayments = async (
  bookingId: string,
): Promise<{ data: AdminPayment[] }> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { venue: { select: { marketplace: { select: { currency: true } } } } },
  });
  if (!booking) {
    throw new AppError({
      code: "BOOKING_NOT_FOUND",
      status: 404,
      detail: "No booking with that id.",
    });
  }
  const currency = booking.venue.marketplace.currency;
  const payments = await prisma.payment.findMany({
    where: { bookingId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      brand: true,
      provider: true,
      providerReference: true,
      providerFee: true,
      succeededAt: true,
      createdAt: true,
      recorder: { select: { id: true, name: true } },
      refunds: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          status: true,
          amount: true,
          reason: true,
          providerReference: true,
          succeededAt: true,
          createdAt: true,
        },
      },
    },
  });
  return {
    data: payments.map((payment) => ({
      ...payment,
      currency,
      succeededAt: payment.succeededAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      refunds: payment.refunds.map((refund) => ({
        ...refund,
        succeededAt: refund.succeededAt?.toISOString() ?? null,
        createdAt: refund.createdAt.toISOString(),
      })),
    })),
  };
};
