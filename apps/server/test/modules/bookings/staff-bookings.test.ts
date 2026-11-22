import { Booking, SharedBooking, StaffBookingDetail, StaffBookingList } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { ALL_PERMISSIONS } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// A venue's bookings for its staff (PR 4.4): the calendar by day and ground, the approvals queue,
// one booking with its history; and the public share link.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const booked = async (token: string, body: object) => {
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

// The venue-local calendar day of an instant (the factory's marketplace timezone).
const localDay = async (marketplaceId: string, instant: Date) => {
  const { timezone } = await prisma.marketplace.findUniqueOrThrow({ where: { id: marketplaceId } });
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(instant);
};

describe("the calendar", () => {
  it("lists the day's bookings that hold slots, by time, and filters by ground and status", async () => {
    const { marketplace, venue, ground, hours } = await aGround({
      settings: { autoConfirm: false },
    });
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const first = await booked(token, { groundId: ground.id, ...at(hours, 2, 3) });
    const second = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    // A declined one no longer holds its slots.
    const declined = await booked(token, { groundId: ground.id, ...at(hours, 3, 4) });
    await asStaff(owner.id, "POST", `/venues/${venue.id}/bookings/${declined.id}/decline`, {});

    const day = await localDay(marketplace.id, hours[0] ?? new Date());
    const res = await asStaff(owner.id, "GET", `/venues/${venue.id}/bookings?date=${day}&span=2`);
    expect(res.status).toBe(200);
    const { data } = StaffBookingList.parse(await res.json());
    expect(data.map((booking) => booking.id)).toEqual([second.id, first.id]);
    expect(data[0]).toMatchObject({
      status: "PENDING",
      source: "APP",
      hold: false,
      customer: { phone: "+201001234567" },
      ground: { id: ground.id, name: "Pitch 1" },
    });

    const cancelled = await asStaff(
      owner.id,
      "GET",
      `/venues/${venue.id}/bookings?date=${day}&span=2&status=CANCELLED`,
    );
    expect(StaffBookingList.parse(await cancelled.json()).data.map((b) => b.id)).toEqual([
      declined.id,
    ]);

    const { ground: other } = await aGround();
    const elsewhere = await asStaff(
      owner.id,
      "GET",
      `/venues/${venue.id}/bookings?date=${day}&span=2&groundId=${other.id}`,
    );
    expect(StaffBookingList.parse(await elsewhere.json()).data).toEqual([]);
  });

  it("queues bookings waiting for approval, soonest deadline first", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const viewer = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, bookings: "view" },
    });
    const { token } = await signedIn();
    const later = await booked(token, { groundId: ground.id, ...at(hours, 2, 3) });
    const sooner = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    await prisma.booking.update({
      where: { id: sooner.id },
      data: { expiresAt: new Date(Date.now() + 60 * 60_000) },
    });

    const res = await asStaff(viewer.id, "GET", `/venues/${venue.id}/bookings/pending`);
    expect(res.status).toBe(200);
    expect(StaffBookingList.parse(await res.json()).data.map((b) => b.id)).toEqual([
      sooner.id,
      later.id,
    ]);
  });

  it("shows one booking with its history, to its venue only", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const confirmed = await booked(token, { groundId: ground.id, ...at(hours, 0, 2) });

    const res = await asStaff(owner.id, "GET", `/venues/${venue.id}/bookings/${confirmed.id}`);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as Record<string, unknown>;
    expect(detail).not.toHaveProperty("commissionRate");
    expect(StaffBookingDetail.parse(detail)).toMatchObject({
      id: confirmed.id,
      status: "CONFIRMED",
      total: 80_000,
      charges: [{ type: "SLOT" }, { type: "SLOT" }],
    });

    const history = await asStaff(
      owner.id,
      "GET",
      `/venues/${venue.id}/bookings/${confirmed.id}/history`,
    );
    expect(await history.json()).toMatchObject({
      data: [{ type: "CREATED", actor: { kind: "CUSTOMER" } }],
      nextCursor: null,
    });

    const { venue: elsewhere } = await aGround();
    const stranger = await staffAt(elsewhere.id);
    const hidden = await asStaff(
      stranger.id,
      "GET",
      `/venues/${elsewhere.id}/bookings/${confirmed.id}`,
    );
    expect(hidden.status).toBe(404);
  });
});

describe("the share link", () => {
  it("shows the venue, ground and time to anyone, without money or the customer", async () => {
    const { ground, hours } = await aGround();
    const { token } = await signedIn();
    const confirmed = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });

    const res = await router.request(`/v1/shared-bookings/${confirmed.code.toLowerCase()}`, {
      headers: { "Accept-Language": "en" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("total");
    expect(body).not.toHaveProperty("customer");
    expect(SharedBooking.parse(body)).toMatchObject({
      code: confirmed.code,
      status: "CONFIRMED",
      venue: { name: "Maadi Arena" },
      ground: { name: "Pitch 1" },
      movedTo: null,
    });

    const missing = await router.request("/v1/shared-bookings/ZZZZZZZZ");
    expect(missing.status).toBe(404);
  });
});
