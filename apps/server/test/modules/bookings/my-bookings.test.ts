import { randomUUID } from "node:crypto";
import { Booking, BookingPage } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { prisma } from "@/platform/db/prisma";
import { aGround, at, book, HOUR, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// A player's bookings (PR 4.4): Upcoming and Past, paged, and one booking's detail.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const get = async (path: string, token: string) =>
  router.request(`/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Accept-Language": "en" },
  });

const list = async (token: string, query: string) => {
  const res = await get(`/bookings?${query}`, token);
  expect(res.status).toBe(200);
  return BookingPage.parse(await res.json());
};

const booked = async (token: string, body: object) =>
  Booking.parse(await (await book(token, body)).json());

// Four one-hour bookings on hours 0–3, then moved into the past or ended as each test needs.
const fourBookings = async () => {
  const { ground, hours } = await aGround();
  const player = await signedIn();
  const bookings = [];
  for (let i = 0; i < 4; i++) {
    bookings.push(await booked(player.token, { groundId: ground.id, ...at(hours, i, i + 1) }));
  }
  return { ...player, bookings, ground, hours };
};

const moveToPast = (id: string, daysAgo: number) => {
  const startsAt = new Date(Date.now() - daysAgo * 24 * HOUR);
  return prisma.booking.update({
    where: { id },
    data: { startsAt, endsAt: new Date(startsAt.getTime() + HOUR) },
  });
};

describe("my bookings", () => {
  it("lists what's still to play soonest first, and the rest latest first", async () => {
    const { token, bookings } = await fourBookings();
    const [first, second, third, fourth] = bookings.map((booking) => booking.id);
    await moveToPast(first ?? "", 3);
    await moveToPast(second ?? "", 1);
    await prisma.booking.update({ where: { id: third }, data: { status: "CANCELLED" } });

    const upcoming = await list(token, "when=upcoming");
    expect(upcoming.data.map((booking) => booking.id)).toEqual([fourth]);
    expect(upcoming.data[0]).toMatchObject({
      status: "CONFIRMED",
      venue: { name: "Maadi Arena", cover: null },
      ground: { name: "Pitch 1", sport: "FOOTBALL" },
      currency: "EGP",
      total: 60_000,
    });
    expect(upcoming.nextCursor).toBeNull();

    const past = await list(token, "when=past");
    // Cancelled (still in the future) first, then played a day ago, then three days ago.
    expect(past.data.map((booking) => booking.id)).toEqual([third, second, first]);
  });

  it("says what each booking needs on the list, and how the past ones ended", async () => {
    const { token, bookings } = await fourBookings();
    const [declined, cancelled, unanswered, upcoming] = bookings.map((booking) => booking.id);
    await moveToPast(declined ?? "", 1);
    await moveToPast(cancelled ?? "", 2);
    await moveToPast(unanswered ?? "", 3);
    await prisma.booking.update({ where: { id: declined }, data: { status: "CANCELLED" } });
    await prisma.cancellation.create({
      data: { bookingId: declined ?? "", initiator: "VENUE", refundPercent: 100, refundAmount: 0 },
    });
    await prisma.bookingEvent.create({ data: { bookingId: declined ?? "", type: "DECLINED" } });
    await prisma.booking.update({ where: { id: cancelled }, data: { status: "CANCELLED" } });
    await prisma.cancellation.create({
      data: {
        bookingId: cancelled ?? "",
        initiator: "CUSTOMER",
        refundPercent: 0,
        refundAmount: 0,
      },
    });
    await prisma.booking.update({ where: { id: unanswered }, data: { status: "EXPIRED" } });
    await prisma.bookingEvent.create({
      data: { bookingId: unanswered ?? "", type: "EXPIRED", data: { from: "PENDING" } },
    });

    const [next] = (await list(token, "when=upcoming")).data;
    expect(next).toMatchObject({
      id: upcoming,
      venue: { timezone: "Africa/Cairo" },
      paymentMode: "MANUAL",
      checkIn: { checkedInAt: null },
      move: null,
      cancellation: null,
      expiredFrom: null,
    });
    expect(Date.parse(next?.checkIn?.opensAt ?? "")).toBe(
      Date.parse(next?.startsAt ?? "") - 15 * 60_000,
    );

    const ended = new Map((await list(token, "when=past")).data.map((each) => [each.id, each]));
    expect(ended.get(declined ?? "")).toMatchObject({
      cancellation: { by: "VENUE", declined: true },
      expiredFrom: null,
    });
    expect(ended.get(cancelled ?? "")).toMatchObject({
      cancellation: { by: "CUSTOMER", declined: false },
    });
    expect(ended.get(unanswered ?? "")).toMatchObject({
      cancellation: null,
      expiredFrom: "PENDING",
      checkIn: null,
    });
  });

  it("leaves out a moved booking, and anyone else's", async () => {
    const { token, bookings, ground, hours } = await fourBookings();
    await prisma.booking.update({
      where: { id: bookings[0]?.id },
      data: { status: "RESCHEDULED" },
    });
    const other = await signedIn("+201009876543");
    await prisma.groundSlot.updateMany({
      where: { groundId: ground.id },
      data: { status: "AVAILABLE", bookingId: null },
    });
    await prisma.booking.updateMany({
      where: { status: { not: "RESCHEDULED" } },
      data: { status: "CANCELLED" },
    });
    await booked(other.token, { groundId: ground.id, ...at(hours, 0, 1) });

    const past = await list(token, "when=past");
    expect(past.data.map((booking) => booking.id)).toEqual(
      bookings
        .slice(1)
        .map((booking) => booking.id)
        .reverse(),
    );
    expect(await list(token, "when=upcoming")).toEqual({ data: [], nextCursor: null });
    expect((await list(other.token, "when=upcoming")).data).toHaveLength(1);
  });

  it("pages through bookings without repeating or skipping any", async () => {
    const { token, bookings } = await fourBookings();

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: BookingPage = await list(
        token,
        `when=upcoming&limit=3${cursor ? `&cursor=${cursor}` : ""}`,
      );
      seen.push(...page.data.map((booking) => booking.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(bookings.map((booking) => booking.id));

    expect((await get("/bookings?cursor=nonsense", token)).status).toBe(400);
  });

  it("shows a player their own booking, and no one else's", async () => {
    const { token, bookings } = await fourBookings();
    const id = bookings[0]?.id ?? "";

    const res = await get(`/bookings/${id}`, token);
    expect(res.status).toBe(200);
    expect(Booking.parse(await res.json())).toMatchObject({ id, status: "CONFIRMED", paid: 0 });

    const other = await signedIn("+201009876543");
    const refused = await get(`/bookings/${id}`, other.token);
    expect(refused.status).toBe(404);
    expect(await refused.json()).toMatchObject({ code: "BOOKING_NOT_FOUND" });
    expect((await get(`/bookings/${randomUUID()}`, token)).status).toBe(404);
  });
});
