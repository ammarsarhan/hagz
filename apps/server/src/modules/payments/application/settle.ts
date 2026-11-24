import { confirmPaidBooking } from "@/modules/bookings";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";

// A payment's outcome arrives (Phase 5: a verified webhook or reconciliation; until then the
// development routes). The payment row is locked first, so a repeated outcome finds it settled and
// changes nothing. Success confirms the booking in the same transaction, unless its payment window
// had already ended: that payment is kept, and refunding it is Phase 5's.

export type Outcome = "SUCCEEDED" | "FAILED";

const alreadySettled = (status: string) =>
  new AppError({
    code: "PAYMENT_SETTLED",
    status: 409,
    detail: "This payment already has its outcome.",
    extensions: { paymentStatus: status },
  });

export const settlePayment = async (
  paymentId: string,
  outcome: Outcome,
  clock: Clock = systemClock,
): Promise<{ bookingId: string; confirmed: boolean }> =>
  transaction(async (tx) => {
    const [payment] = await tx.$queryRaw<{ id: string; bookingId: string; status: string }[]>`
      SELECT id, "bookingId", status FROM "Payment" WHERE id = ${paymentId}::uuid FOR UPDATE`;
    if (!payment) throw new Error(`Payment ${paymentId} doesn't exist.`);
    if (payment.status !== "PENDING") throw alreadySettled(payment.status);

    if (outcome === "FAILED") {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      return { bookingId: payment.bookingId, confirmed: false };
    }
    const now = clock.now();
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", succeededAt: now },
    });
    const confirmed = await confirmPaidBooking(tx, payment.bookingId, payment.id, now);
    if (!confirmed) {
      logger.warn(
        { paymentId: payment.id, bookingId: payment.bookingId },
        "payment succeeded after its booking stopped waiting for it; it needs a refund",
      );
    }
    return { bookingId: payment.bookingId, confirmed };
  });

const paymentNotFound = () =>
  new AppError({
    code: "PAYMENT_NOT_FOUND",
    status: 404,
    detail: "No payment of yours with that id.",
  });

// The development routes settle only the caller's own payments.
export const ownPayment = async (customerId: string, paymentId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, booking: { customer: { customerId } } },
    select: { id: true },
  });
  if (!payment) throw paymentNotFound();
};
