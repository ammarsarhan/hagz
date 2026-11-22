import { randomUUID } from "node:crypto";
import {
  AdminBooking,
  AdminBookingDetail,
  AdminPayment,
  Booking,
  BookingHistoryEvent,
  Checkout,
  list,
  page,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { router } from "@/http/router";
import { expireDueBookings } from "@/modules/bookings/application/expire-bookings";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { aGround, at, book, HOUR, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { createAdmin } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Bookings in the admin: the lookup table with its tabs and search, one booking in full, its
// payments and its events.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const adminCookie = async () => {
  const { secret } = await createAdmin();
  const signIn = await router.request("/v1/auth/admin/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ email: "omar@hagz.app", password: "correct horse battery" }),
  });
  const { challengeToken } = (await signIn.json()) as { challengeToken: string };
  const done = await router.request("/v1/auth/admin/sessions/totp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ challengeToken, code: totpCode(secret, totpStep(new Date())) }),
  });
  return done.headers
    .getSetCookie()
    .map((cookie) => cookie.split("; ")[0])
    .join("; ");
};

const get = async (path: string, cookie: string) =>
  router.request(`/v1${path}`, { headers: { "X-Hagz-Admin": "1", Cookie: cookie } });

const BookingsPage = page(AdminBooking).extend({ counts: z.record(z.string(), z.int()) });

const lookup = async (cookie: string, query = "") => {
  const res = await get(`/admin/bookings${query}`, cookie);
  expect(res.status).toBe(200);
  return BookingsPage.parse(await res.json());
};

const post = async (path: string, token: string, body?: object) =>
  router.request(`/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("the admin's bookings", () => {
  it("lists every booking newest first, with counts per status, a tab and a page at a time", async () => {
    const { ground, hours } = await aGround();
    const ahmed = await signedIn();
    const first = Booking.parse(
      await (await book(ahmed.token, { groundId: ground.id, ...at(hours, 0, 1) })).json(),
    );
    const second = Booking.parse(
      await (await book(ahmed.token, { groundId: ground.id, ...at(hours, 1, 2) })).json(),
    );
    const third = Booking.parse(
      await (await book(ahmed.token, { groundId: ground.id, ...at(hours, 2, 3) })).json(),
    );
    await prisma.booking.update({ where: { id: second.id }, data: { status: "CANCELLED" } });
    const cookie = await adminCookie();

    const all = await lookup(cookie);
    expect(all.data.map((booking) => booking.id)).toEqual([third.id, second.id, first.id]);
    expect(all.counts).toMatchObject({ CONFIRMED: 2, CANCELLED: 1, PENDING: 0 });
    expect(all.data[0]).toMatchObject({
      code: third.code,
      timezone: "Africa/Cairo",
      venue: { names: { en: "Maadi Arena", ar: null } },
      ground: { name: "Pitch 1" },
      customer: { name: "Ahmed", phone: "+201001234567" },
      source: "APP",
      total: 60_000,
    });

    const cancelled = await lookup(cookie, "?status=CANCELLED");
    expect(cancelled.data.map((booking) => booking.id)).toEqual([second.id]);

    const firstPage = await lookup(cookie, "?limit=2");
    expect(firstPage.data).toHaveLength(2);
    const secondPage = await lookup(cookie, `?limit=2&cursor=${firstPage.nextCursor ?? ""}`);
    expect(secondPage.data.map((booking) => booking.id)).toEqual([first.id]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("searches by code, customer name or phone, and venue name", async () => {
    const { ground, hours } = await aGround();
    const ahmed = await signedIn();
    const mine = Booking.parse(
      await (await book(ahmed.token, { groundId: ground.id, ...at(hours, 0, 1) })).json(),
    );
    const other = await signedIn("+201009876543");
    await prisma.customer.update({ where: { id: other.customer.id }, data: { name: "Karim" } });
    await book(other.token, { groundId: ground.id, ...at(hours, 1, 2) });
    const cookie = await adminCookie();

    const ids = async (q: string) =>
      (await lookup(cookie, `?q=${encodeURIComponent(q)}`)).data.map((booking) => booking.id);
    expect(await ids(mine.code.toLowerCase())).toEqual([mine.id]);
    expect(await ids("ahm")).toEqual([mine.id]);
    expect(await ids("1234567")).toEqual([mine.id]);
    expect(await ids("maadi")).toHaveLength(2);
    expect(await ids("nobody")).toEqual([]);
    // Counts follow the search too.
    expect((await lookup(cookie, "?q=karim")).counts.CONFIRMED).toBe(1);
  });

  it("lists one venue's bookings, with that venue's counts", async () => {
    const maadi = await aGround();
    const other = await aGround();
    const { token } = await signedIn();
    const here = Booking.parse(
      await (await book(token, { groundId: maadi.ground.id, ...at(maadi.hours, 0, 1) })).json(),
    );
    await book(token, { groundId: other.ground.id, ...at(other.hours, 0, 1) });
    const cookie = await adminCookie();

    const venue = await lookup(cookie, `?venueId=${maadi.venue.id}`);
    expect(venue.data.map((booking) => booking.id)).toEqual([here.id]);
    expect(venue.counts.CONFIRMED).toBe(1);
    expect((await lookup(cookie)).counts.CONFIRMED).toBe(2);
    const ground = await lookup(cookie, `?venueId=${maadi.venue.id}&groundId=${other.ground.id}`);
    expect(ground.data).toEqual([]);
    expect(ground.counts.CONFIRMED).toBe(0);
  });

  it("shows one booking in full, its payments and its history", async () => {
    const { ground, hours } = await aGround({
      settings: { paymentMode: "DEPOSIT", depositPercent: 50 },
    });
    const { token, customer } = await signedIn();
    const booking = Booking.parse(
      await (await book(token, { groundId: ground.id, ...at(hours, 0, 1), note: "Bibs" })).json(),
    );
    const failed = Checkout.parse(
      await (await post(`/bookings/${booking.id}/payments`, token, {})).json(),
    );
    await post(`/dev/payments/${failed.payment.id}/fail`, token);
    const paid = Checkout.parse(
      await (await post(`/bookings/${booking.id}/payments`, token, {})).json(),
    );
    await post(`/dev/payments/${paid.payment.id}/succeed`, token);
    const cookie = await adminCookie();

    const res = await get(`/admin/bookings/${booking.id}`, cookie);
    expect(res.status).toBe(200);
    expect(AdminBookingDetail.parse(await res.json())).toMatchObject({
      id: booking.id,
      status: "CONFIRMED",
      note: "Bibs",
      customer: { accountId: customer.id, name: "Ahmed" },
      creator: null,
      paymentMode: "DEPOSIT",
      deposit: 20_000,
      paid: 20_000,
      commissionRate: 0,
      cancellation: { policy: "MODERATE" },
      cancelled: null,
      movedFrom: null,
      movedTo: [],
      charges: [{ type: "SLOT", amount: 40_000, taxRate: 0, taxAmount: 0 }],
    });

    const payments = list(AdminPayment).parse(
      await (await get(`/admin/bookings/${booking.id}/payments`, cookie)).json(),
    );
    expect(
      payments.data.map((payment) => [payment.status, payment.amount, payment.provider]),
    ).toEqual([
      ["FAILED", 20_000, "fake"],
      ["SUCCEEDED", 20_000, "fake"],
    ]);
    expect(payments.data[1]).toMatchObject({
      currency: "EGP",
      providerReference: `fake_${paid.payment.id}`,
      refunds: [],
    });

    const history = page(BookingHistoryEvent).parse(
      await (await get(`/admin/bookings/${booking.id}/history`, cookie)).json(),
    );
    expect(history.data.map((event) => [event.type, event.actor.kind, event.actor.name])).toEqual([
      ["CONFIRMED", "SYSTEM", null],
      ["CREATED", "CUSTOMER", "Ahmed"],
    ]);
    expect(history.nextCursor).toBeNull();
  });

  it("lists an expired booking's sweep as the system's, and answers 404 for unknown ids", async () => {
    const { ground, hours } = await aGround({ settings: { paymentMode: "PLATFORM" } });
    const { token } = await signedIn();
    const booking = Booking.parse(
      await (await book(token, { groundId: ground.id, ...at(hours, 0, 1) })).json(),
    );
    await expireDueBookings({ now: () => new Date(Date.now() + HOUR) });
    const cookie = await adminCookie();

    const history = page(BookingHistoryEvent).parse(
      await (await get(`/admin/bookings/${booking.id}/history?limit=1`, cookie)).json(),
    );
    expect(history.data).toEqual([
      expect.objectContaining({
        type: "EXPIRED",
        actor: { kind: "SYSTEM", id: null, name: null },
        data: { from: "HELD" },
      }),
    ]);
    expect(history.nextCursor).not.toBeNull();

    for (const path of ["", "/payments", "/history"]) {
      const res = await get(`/admin/bookings/${randomUUID()}${path}`, cookie);
      expect(res.status).toBe(404);
    }
  });

  it("is for admins only", async () => {
    const { token } = await signedIn();
    expect((await get("/admin/bookings", "")).status).toBe(401);
    const asPlayer = await router.request("/v1/admin/bookings", {
      headers: { Authorization: `Bearer ${token}`, "X-Hagz-Admin": "1" },
    });
    expect(asPlayer.status).toBe(401);
  });
});
