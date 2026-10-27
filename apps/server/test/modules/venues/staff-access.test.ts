import { randomUUID } from "node:crypto";
import { list, StaffVenue, VenueMember, type StaffPermissions } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { restrictAfterPasswordReset } from "@/modules/venues";
import { venueAccess } from "@/modules/venues/application/access";
import { changePermissions } from "@/modules/venues/application/members";
import { systemClock } from "@/platform/clock/clock";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { resetDatabase } from "../../support/database";
import { addMember, createMarketplace, createStaff, createVenue } from "../../support/factories";

// The policy layer: a staff member reaches a venue only through a membership, with the level its
// permissions give, checked on every request. Venues they don't belong to look like no venue at all.

const permissions = (overrides: Partial<StaffPermissions> = {}): StaffPermissions => ({
  bookings: "none",
  customers: "none",
  schedule: "none",
  payments: "none",
  finance: "none",
  staff: "none",
  venue: "none",
  ...overrides,
});

// requireStaff doesn't look up the session, so a signed token is all a request needs.
const tokenFor = (staffId: string, audience: "staff" | "customer" = "staff") =>
  signJwt({ sub: staffId, sid: randomUUID() }, { audience, ttlSeconds: 600 });

const call = async (staffId: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1/staff${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${await tokenFor(staffId)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const problem = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  delete body.requestId;
  return body;
};
const membershipOf = async (venueId: string, staffId: string) =>
  (
    await prisma.venueMembership.findUniqueOrThrow({
      where: { venueId_staffId: { venueId, staffId } },
    })
  ).permissions;

let phone = 0;
const staffMember = () => createStaff({ phone: `+2010011${String(phone++).padStart(5, "0")}` });

// Two venues with separate staff. In A: the owner, a manager (manages staff, views bookings) and a
// cashier (no staff access).
const world = async () => {
  const { id: marketplaceId } = await createMarketplace();
  const [a, b] = [await createVenue(marketplaceId), await createVenue(marketplaceId)];
  const [ownerA, manager, cashier, ownerB, memberB] = [
    await staffMember(),
    await staffMember(),
    await staffMember(),
    await staffMember(),
    await staffMember(),
  ];
  await addMember(a.id, ownerA.id, { role: "OWNER", permissions: permissions() });
  await addMember(a.id, manager.id, {
    permissions: permissions({ staff: "manage", bookings: "view" }),
  });
  await addMember(a.id, cashier.id, { permissions: permissions({ payments: "manage" }) });
  await addMember(b.id, ownerB.id, { role: "OWNER", permissions: permissions() });
  await addMember(b.id, memberB.id, { permissions: permissions({ bookings: "manage" }) });
  return { a, b, ownerA, manager, cashier, ownerB, memberB };
};

beforeEach(async () => {
  phone = 0;
  await resetDatabase();
});

describe("my venues", () => {
  it("lists only my venues, with what I can do at each", async () => {
    const { a, b, ownerA, manager } = await world();
    await addMember(b.id, manager.id, { permissions: permissions({ venue: "view" }) });

    const mine = list(StaffVenue).parse(await (await call(manager.id, "GET", "/venues")).json());
    expect(mine.data.map((v) => [v.id, v.role, v.permissions])).toEqual([
      [a.id, "MEMBER", permissions({ staff: "manage", bookings: "view" })],
      [b.id, "MEMBER", permissions({ venue: "view" })],
    ]);

    const owned = list(StaffVenue).parse(await (await call(ownerA.id, "GET", "/venues")).json());
    expect(owned.data).toHaveLength(1);
    expect(owned.data[0]?.permissions).toEqual(
      permissions({
        bookings: "manage",
        customers: "manage",
        schedule: "manage",
        payments: "manage",
        finance: "manage",
        staff: "manage",
        venue: "manage",
      }),
    );
  });
});

describe("tenant isolation", () => {
  it("answers a venue I don't belong to exactly like one that doesn't exist", async () => {
    const { b, ownerA } = await world();

    const other = await call(ownerA.id, "GET", `/venues/${b.id}/members`);
    const missing = await call(ownerA.id, "GET", `/venues/${randomUUID()}/members`);
    const malformed = await call(ownerA.id, "GET", "/venues/not-a-venue/members");

    expect(other.status).toBe(404);
    const body = await problem(other);
    expect(body.code).toBe("VENUE_NOT_FOUND");
    expect(await problem(missing)).toEqual(body);
    expect(await problem(malformed)).toEqual(body);
  });

  it("doesn't let an owner change another venue's staff", async () => {
    const { a, b, ownerA, memberB } = await world();

    // Through the other venue's path...
    const direct = await call(
      ownerA.id,
      "PUT",
      `/venues/${b.id}/members/${memberB.id}/permissions`,
      {
        ...permissions(),
      },
    );
    expect(direct.status).toBe(404);
    // ...or through their own venue's path with the other venue's member.
    const smuggled = await call(
      ownerA.id,
      "PUT",
      `/venues/${a.id}/members/${memberB.id}/permissions`,
      permissions(),
    );
    expect(smuggled.status).toBe(404);
    expect((await problem(smuggled)).code).toBe("MEMBER_NOT_FOUND");

    expect(await membershipOf(b.id, memberB.id)).toEqual(permissions({ bookings: "manage" }));
    expect(await prisma.venueEvent.count()).toBe(0);
  });

  it("only lists the venue's own members", async () => {
    const { a, ownerA, manager, cashier } = await world();
    const res = await call(ownerA.id, "GET", `/venues/${a.id}/members`);
    const members = list(VenueMember).parse(await res.json());
    expect(members.data.map((m) => m.staffId).sort()).toEqual(
      [ownerA.id, manager.id, cashier.id].sort(),
    );
  });

  it("rejects a customer's token", async () => {
    const { a, ownerA } = await world();
    const res = await router.request(`/v1/staff/venues/${a.id}/members`, {
      headers: { Authorization: `Bearer ${await tokenFor(ownerA.id, "customer")}` },
    });
    expect(res.status).toBe(401);
  });
});

describe("permission levels", () => {
  it("needs view to read and manage to change", async () => {
    const { a, manager, cashier } = await world();
    const { id: viewer } = await staffMember();
    await addMember(a.id, viewer, { permissions: permissions({ staff: "view" }) });

    expect((await call(viewer, "GET", `/venues/${a.id}/members`)).status).toBe(200);
    const write = await call(viewer, "PUT", `/venues/${a.id}/members/${cashier.id}/permissions`, {
      ...permissions(),
    });
    expect(write.status).toBe(403);
    expect(await problem(write)).toMatchObject({
      code: "PERMISSION_DENIED",
      area: "staff",
      needed: "manage",
    });

    const none = await call(cashier.id, "GET", `/venues/${a.id}/members`);
    expect(none.status).toBe(403);
    expect((await call(manager.id, "GET", `/venues/${a.id}/members`)).status).toBe(200);
  });

  it("applies a demotion to the very next request, with the same access token", async () => {
    const { a, ownerA, manager } = await world();
    const token = await tokenFor(manager.id);
    const listMembers = () =>
      router.request(`/v1/staff/venues/${a.id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    expect((await listMembers()).status).toBe(200);

    const demoted = await call(
      ownerA.id,
      "PUT",
      `/venues/${a.id}/members/${manager.id}/permissions`,
      {
        ...permissions(),
      },
    );
    expect(demoted.status).toBe(200);

    expect((await listMembers()).status).toBe(403);
  });

  it("locks out a suspended member at once", async () => {
    const { a, manager } = await world();
    await prisma.staff.update({ where: { id: manager.id }, data: { status: "SUSPENDED" } });
    const res = await call(manager.id, "GET", `/venues/${a.id}/members`);
    expect(res.status).toBe(403);
    expect((await problem(res)).code).toBe("ACCOUNT_SUSPENDED");
    expect((await call(manager.id, "GET", "/venues")).status).toBe(403);
  });
});

describe("changing permissions", () => {
  it("records who changed what", async () => {
    const { a, manager, cashier } = await world();
    const next = permissions({ payments: "none", bookings: "view" });
    const res = await call(
      manager.id,
      "PUT",
      `/venues/${a.id}/members/${cashier.id}/permissions`,
      next,
    );
    expect(res.status).toBe(200);
    expect(await membershipOf(a.id, cashier.id)).toEqual(next);

    const event = await prisma.venueEvent.findFirstOrThrow();
    expect(event).toMatchObject({
      venueId: a.id,
      type: "STAFF_PERMISSIONS_CHANGED",
      staffId: manager.id,
      data: {
        memberId: cashier.id,
        previousPermissions: permissions({ payments: "manage" }),
        permissions: next,
      },
    });
  });

  it("doesn't let a manager give more than they have, but lets the owner", async () => {
    const { a, ownerA, manager, cashier } = await world();
    const more = permissions({ bookings: "manage", finance: "view" });

    const res = await call(
      manager.id,
      "PUT",
      `/venues/${a.id}/members/${cashier.id}/permissions`,
      more,
    );
    expect(res.status).toBe(403);
    expect(await problem(res)).toMatchObject({
      code: "PERMISSION_ABOVE_YOUR_OWN",
      areas: ["bookings", "finance"],
    });
    expect(await membershipOf(a.id, cashier.id)).toEqual(permissions({ payments: "manage" }));

    const byOwner = await call(
      ownerA.id,
      "PUT",
      `/venues/${a.id}/members/${cashier.id}/permissions`,
      more,
    );
    expect(byOwner.status).toBe(200);
  });

  it("doesn't let anyone change their own permissions or the owner's", async () => {
    const { a, ownerA, manager } = await world();
    const self = await call(
      manager.id,
      "PUT",
      `/venues/${a.id}/members/${manager.id}/permissions`,
      {
        ...permissions({ staff: "manage" }),
      },
    );
    expect((await problem(self)).code).toBe("CANNOT_CHANGE_OWN_PERMISSIONS");

    const owner = await call(
      manager.id,
      "PUT",
      `/venues/${a.id}/members/${ownerA.id}/permissions`,
      {
        ...permissions(),
      },
    );
    expect(owner.status).toBe(403);
    expect((await problem(owner)).code).toBe("CANNOT_CHANGE_OWNER");
  });
});

describe("changing permissions, racing a demotion", () => {
  it("re-checks the granter inside the transaction", async () => {
    const { a, ownerA, manager, cashier } = await world();
    // The manager passed the access check...
    const access = await venueAccess(manager.id, a.id);
    // ...then the owner took staff management away before the change ran.
    await call(
      ownerA.id,
      "PUT",
      `/venues/${a.id}/members/${manager.id}/permissions`,
      permissions(),
    );

    await expect(changePermissions(access, cashier.id, permissions())).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    expect(await membershipOf(a.id, cashier.id)).toEqual(permissions({ payments: "manage" }));
  });
});

describe("restoring after a password reset", () => {
  const resetPassword = (staffId: string) =>
    transaction((tx) => restrictAfterPasswordReset(tx, staffId, systemClock));
  const restorable = async (venueId: string, ownerId: string, memberId: string) => {
    const res = await call(ownerId, "GET", `/venues/${venueId}/members`);
    return list(VenueMember)
      .parse(await res.json())
      .data.find((m) => m.staffId === memberId)?.restorable;
  };

  it("gives back exactly what they had, once", async () => {
    const { a, ownerA, cashier } = await world();
    await resetPassword(cashier.id);
    expect(await membershipOf(a.id, cashier.id)).toEqual(permissions({ payments: "view" }));
    expect(await restorable(a.id, ownerA.id, cashier.id)).toBe(true);

    const path = `/venues/${a.id}/members/${cashier.id}/permissions/restore`;
    const res = await call(ownerA.id, "POST", path);
    expect(res.status).toBe(200);
    expect(await membershipOf(a.id, cashier.id)).toEqual(permissions({ payments: "manage" }));
    expect(await restorable(a.id, ownerA.id, cashier.id)).toBe(false);

    const again = await call(ownerA.id, "POST", path);
    expect(again.status).toBe(409);
    expect((await problem(again)).code).toBe("NOTHING_TO_RESTORE");
  });

  it("doesn't override permissions someone set since", async () => {
    const { a, ownerA, cashier } = await world();
    await resetPassword(cashier.id);
    await call(ownerA.id, "PUT", `/venues/${a.id}/members/${cashier.id}/permissions`, {
      ...permissions({ bookings: "view" }),
    });

    expect(await restorable(a.id, ownerA.id, cashier.id)).toBe(false);
    const res = await call(
      ownerA.id,
      "POST",
      `/venues/${a.id}/members/${cashier.id}/permissions/restore`,
    );
    expect(res.status).toBe(409);
    expect(await membershipOf(a.id, cashier.id)).toEqual(permissions({ bookings: "view" }));
  });

  it("keeps the granter's limits", async () => {
    const { a, manager, cashier } = await world();
    await resetPassword(cashier.id);
    // The cashier had payments: manage, which the manager doesn't have.
    const res = await call(
      manager.id,
      "POST",
      `/venues/${a.id}/members/${cashier.id}/permissions/restore`,
    );
    expect(res.status).toBe(403);
    expect(await problem(res)).toMatchObject({
      code: "PERMISSION_ABOVE_YOUR_OWN",
      areas: ["payments"],
    });
  });

  it("doesn't restore over a change that left no event", async () => {
    const { a, ownerA, cashier } = await world();
    await resetPassword(cashier.id);
    await prisma.venueMembership.update({
      where: { venueId_staffId: { venueId: a.id, staffId: cashier.id } },
      data: { permissions: permissions() },
    });

    expect(await restorable(a.id, ownerA.id, cashier.id)).toBe(false);
    const res = await call(
      ownerA.id,
      "POST",
      `/venues/${a.id}/members/${cashier.id}/permissions/restore`,
    );
    expect(res.status).toBe(409);
  });
});
