import { VenueCustomer, VenueCustomerPage } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// The venue's customers (PR 4.3): app players who booked there and walk-ins staff entered.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("venue customers", () => {
  it("lists app players and walk-ins A to Z, searches, and pages", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    expect((await book(token, { groundId: ground.id, ...at(hours, 0, 1) })).status).toBe(201);
    for (const name of ["Zeyad", "Karim", "Bassem"]) {
      const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/customers`, { name });
      expect(res.status).toBe(201);
    }

    const all = VenueCustomerPage.parse(
      await (await asStaff(owner.id, "GET", `/venues/${venue.id}/customers?limit=2`)).json(),
    );
    expect(all.data.map((customer) => customer.name)).toEqual(["Ahmed", "Bassem"]);
    const next = VenueCustomerPage.parse(
      await (
        await asStaff(
          owner.id,
          "GET",
          `/venues/${venue.id}/customers?limit=2&cursor=${all.nextCursor}`,
        )
      ).json(),
    );
    expect(next.data.map((customer) => customer.name)).toEqual(["Karim", "Zeyad"]);
    expect(all.data[0]).toMatchObject({ app: true, phone: "+201001234567" });
    expect(next.nextCursor).toBeNull();

    const byPhone = VenueCustomerPage.parse(
      await (await asStaff(owner.id, "GET", `/venues/${venue.id}/customers?q=100 123`)).json(),
    );
    expect(byPhone.data.map((customer) => customer.name)).toEqual(["Ahmed"]);
  });

  it("lists who played last first, then who was added last, as one page", async () => {
    const { venue } = await aGround();
    const owner = await staffAt(venue.id);
    const ids: Record<string, string> = {};
    for (const name of ["Zeyad", "Karim", "Bassem", "Omar"]) {
      const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/customers`, { name });
      ids[name] = VenueCustomer.parse(await res.json()).id;
    }
    await prisma.venueCustomer.update({
      where: { id: ids.Karim },
      data: { lastBookedAt: new Date("2026-01-02T18:00:00Z") },
    });
    await prisma.venueCustomer.update({
      where: { id: ids.Zeyad },
      data: { lastBookedAt: new Date("2026-01-05T18:00:00Z") },
    });

    const recent = VenueCustomerPage.parse(
      await (
        await asStaff(owner.id, "GET", `/venues/${venue.id}/customers?order=recent&limit=3`)
      ).json(),
    );
    expect(recent.data.map((customer) => customer.name)).toEqual(["Zeyad", "Karim", "Omar"]);
    expect(recent.nextCursor).toBeNull();
    const paged = await asStaff(
      owner.id,
      "GET",
      `/venues/${venue.id}/customers?order=recent&cursor=abc`,
    );
    expect(paged.status).toBe(400);
  });

  it("adds a walk-in with a normalized number, and refuses a number already there", async () => {
    const { venue } = await aGround();
    const owner = await staffAt(venue.id);
    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/customers`, {
      name: "Karim",
      phone: "+20 100 555 1234",
      note: "Thursday team captain",
    });
    expect(res.status).toBe(201);
    const karim = VenueCustomer.parse(await res.json());
    expect(karim).toMatchObject({
      phone: "+201005551234",
      app: false,
      note: "Thursday team captain",
    });

    const again = await asStaff(owner.id, "POST", `/venues/${venue.id}/customers`, {
      name: "Karim A.",
      phone: "+201005551234",
    });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "CUSTOMER_EXISTS", customerId: karim.id });
  });

  it("edits a walk-in's name and number, but only the note of an app player", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const walkIn = VenueCustomer.parse(
      await (
        await asStaff(owner.id, "POST", `/venues/${venue.id}/customers`, { name: "Karim" })
      ).json(),
    );
    const edited = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/customers/${walkIn.id}`, {
      name: "Karim Adel",
      phone: "+201005551234",
    });
    expect(VenueCustomer.parse(await edited.json())).toMatchObject({
      name: "Karim Adel",
      phone: "+201005551234",
    });

    const { token } = await signedIn();
    await book(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const player = await prisma.venueCustomer.findFirstOrThrow({
      where: { venueId: venue.id, customerId: { not: null } },
    });
    const renamed = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/customers/${player.id}`, {
      name: "Someone else",
    });
    expect(renamed.status).toBe(409);
    expect(await renamed.json()).toMatchObject({ code: "CUSTOMER_LINKED" });
    const noted = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/customers/${player.id}`, {
      note: "Pays late",
    });
    expect(VenueCustomer.parse(await noted.json())).toMatchObject({ note: "Pays late", app: true });
    const cleared = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/customers/${player.id}`, {
      note: "",
    });
    expect(VenueCustomer.parse(await cleared.json()).note).toBeNull();
  });

  it("reads with customers: view, and changes need customers: manage", async () => {
    const { venue } = await aGround();
    const viewer = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, customers: "view" },
    });
    expect((await asStaff(viewer.id, "GET", `/venues/${venue.id}/customers`)).status).toBe(200);
    const denied = await asStaff(viewer.id, "POST", `/venues/${venue.id}/customers`, {
      name: "Karim",
    });
    expect(denied.status).toBe(403);
  });
});
