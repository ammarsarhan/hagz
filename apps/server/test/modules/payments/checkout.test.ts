import { randomUUID } from "node:crypto";
import { Booking, Checkout } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { startCheckout } from "@/modules/payments/application/checkout";
import { settlePayment } from "@/modules/payments/application/settle";
import { prisma } from "@/platform/db/prisma";
import { aGround, at, book, HOUR, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Paying for a HELD booking through the stand-in provider (Phase 4): the checkout, settling it by
// hand as the provider would, and a payment that lands after the booking stopped waiting.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const post = async (path: string, token: string, body?: object, key: string = randomUUID()) =>
  router.request(`/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Language": "en",
      "Idempotency-Key": key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// A booking at a deposit venue, waiting for 25% of 80,000.
const aHeldBooking = async () => {
  const { ground, hours } = await aGround({
    settings: { paymentMode: "DEPOSIT", depositPercent: 25 },
  });
  const player = await signedIn();
  const booking = Booking.parse(
    await (await book(player.token, { groundId: ground.id, ...at(hours, 0, 2) })).json(),
  );
  expect(booking.status).toBe("HELD");
  return { ...player, booking, ground, hours };
};

describe("paying for a booking", () => {
  it("starts a checkout for the deposit and confirms the booking once paid", async () => {
    const { token, booking } = await aHeldBooking();

    const res = await post(`/bookings/${booking.id}/payments`, token, {});
    expect(res.status).toBe(201);
    const checkout = Checkout.parse(await res.json());
    expect(checkout).toMatchObject({
      payment: { status: "PENDING", method: "CARD", amount: 20_000, currency: "EGP" },
      provider: "fake",
      reference: `fake_${checkout.payment.id}`,
      url: null,
    });

    const paid = await post(`/dev/payments/${checkout.payment.id}/succeed`, token);
    expect(paid.status).toBe(200);
    expect(Booking.parse(await paid.json())).toMatchObject({
      status: "CONFIRMED",
      expiresAt: null,
      paid: 20_000,
    });
    const slots = await prisma.groundSlot.findMany({ where: { bookingId: booking.id } });
    expect(slots.map((slot) => slot.status)).toEqual(["BOOKED", "BOOKED"]);
    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => event.type)).toEqual(["CREATED", "CONFIRMED"]);

    // A repeated outcome changes nothing.
    const again = await post(`/dev/payments/${checkout.payment.id}/succeed`, token);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "PAYMENT_SETTLED" });
  });

  it("keeps the booking waiting after a failed payment, and lets a new checkout replace an old one", async () => {
    const { token, booking } = await aHeldBooking();

    const first = Checkout.parse(
      await (await post(`/bookings/${booking.id}/payments`, token, {})).json(),
    );
    const failed = await post(`/dev/payments/${first.payment.id}/fail`, token);
    expect(Booking.parse(await failed.json())).toMatchObject({ status: "HELD", paid: 0 });

    const second = Checkout.parse(
      await (await post(`/bookings/${booking.id}/payments`, token, { method: "WALLET" })).json(),
    );
    const third = Checkout.parse(
      await (await post(`/bookings/${booking.id}/payments`, token, {})).json(),
    );
    const statuses = await prisma.payment.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true },
    });
    expect(statuses).toEqual([
      { id: first.payment.id, status: "FAILED" },
      { id: second.payment.id, status: "EXPIRED" },
      { id: third.payment.id, status: "PENDING" },
    ]);
  });

  it("answers a retry with the same payment", async () => {
    const { token, booking } = await aHeldBooking();
    const key = randomUUID();

    const first = Checkout.parse(
      await (await post(`/bookings/${booking.id}/payments`, token, {}, key)).json(),
    );
    const retry = await post(`/bookings/${booking.id}/payments`, token, {}, key);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotent-Replayed")).toBe("true");
    expect(Checkout.parse(await retry.json()).payment.id).toBe(first.payment.id);
    expect(
      (await post(`/bookings/${booking.id}/payments`, token, { method: "WALLET" }, key)).status,
    ).toBe(422);
    expect(await prisma.payment.count()).toBe(1);
  });

  it("refuses bookings that aren't waiting for payment, or aren't yours", async () => {
    const { token, booking, ground, hours } = await aHeldBooking();
    const other = await signedIn("+201009876543");
    expect((await post(`/bookings/${booking.id}/payments`, other.token, {})).status).toBe(404);

    await prisma.venueSettings.updateMany({
      data: { paymentMode: "MANUAL", depositPercent: null },
    });
    const confirmed = Booking.parse(
      await (await book(other.token, { groundId: ground.id, ...at(hours, 2, 3) })).json(),
    );
    const refused = await post(`/bookings/${confirmed.id}/payments`, other.token, {});
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({
      code: "BOOKING_NOT_AWAITING_PAYMENT",
      bookingStatus: "CONFIRMED",
    });

    // Past its payment window, though not swept yet.
    await prisma.booking.update({
      where: { id: booking.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const late = await post(`/bookings/${booking.id}/payments`, token, {});
    expect(late.status).toBe(409);
    expect(await late.json()).toMatchObject({ code: "HOLD_EXPIRED" });
  });

  it("keeps a payment that lands after the window, without confirming the booking", async () => {
    const { customer, booking } = await aHeldBooking();
    const { checkout } = await startCheckout(
      customer.id,
      booking.id,
      { method: "CARD" },
      randomUUID(),
    );

    const later = { now: () => new Date(Date.now() + HOUR) };
    expect(await settlePayment(checkout.payment.id, "SUCCEEDED", later)).toEqual({
      bookingId: booking.id,
      confirmed: false,
    });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: checkout.payment.id } }),
    ).toMatchObject({
      status: "SUCCEEDED",
    });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: "HELD",
    });
  });
});
