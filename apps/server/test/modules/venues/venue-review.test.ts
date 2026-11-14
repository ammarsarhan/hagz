import { randomUUID } from "node:crypto";
import {
  Ground,
  ReviewVenue,
  VenueHistoryEvent,
  VenueSetup,
  list,
  type CreateGround,
  type CreateVenue,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { router } from "@/http/router";
import { ALL_PERMISSIONS } from "@/modules/venues/domain/permissions";
import { signJwt } from "@/platform/crypto/jwt";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { addMember, createAdmin, createMarketplace, createStaff } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// ---------- Callers ----------

const staff = async (staffId: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1/staff${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "Accept-Language": "en",
      Authorization: `Bearer ${await signJwt({ sub: staffId, sid: randomUUID() }, { audience: "staff", ttlSeconds: 600 })}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let cookie = "";
let adminId = "";
const admin = (method: string, path: string, body?: unknown) =>
  router.request(`/v1/admin${path}`, {
    method,
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const signIn = async () => {
  const { id, secret } = await createAdmin();
  adminId = id;
  const start = await router.request("/v1/auth/admin/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ email: "omar@hagz.app", password: "correct horse battery" }),
  });
  const { challengeToken } = (await start.json()) as { challengeToken: string };
  const done = await router.request("/v1/auth/admin/sessions/totp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ challengeToken, code: totpCode(secret, totpStep(new Date())) }),
  });
  expect(done.status).toBe(201);
  cookie = done.headers
    .getSetCookie()
    .map((c) => c.split("; ")[0])
    .join("; ");
};

const problem = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  delete body.requestId;
  return body;
};

// ---------- A draft with every required item done ----------

const PITCH: CreateGround = {
  name: "Pitch 1",
  sport: "FOOTBALL",
  size: "FIVE_A_SIDE",
  surface: "ARTIFICIAL_TURF",
  environment: "OUTDOOR",
  basePrice: 60000,
  peakPrice: null,
  discountPrice: null,
  minimumSlots: 1,
  maximumSlots: 3,
};

let phones = 0;
const aDraft = async () => {
  const marketplace = await createMarketplace();
  const area = await prisma.location.create({
    data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: `maadi-${phones}` },
  });
  const owner = await createStaff({
    phone: `+2010077${String(phones++).padStart(5, "0")}`,
    language: "EN",
  });
  const body: CreateVenue = {
    name: "Champions Arena",
    coordinates: { latitude: 29.96, longitude: 31.25 },
    locationId: area.id,
  };
  const created = VenueSetup.parse(await (await staff(owner.id, "POST", "/venues", body)).json());
  return { owner, venueId: created.venue.id, path: `/venues/${created.venue.id}` };
};

const aReadyDraft = async () => {
  const draft = await aDraft();
  const { owner, venueId, path } = draft;
  await staff(owner.id, "PATCH", path, { phone: "+20 2 2358 0000" });
  await staff(owner.id, "PUT", `${path}/translations/EN`, {
    name: "Champions Arena",
    description: "Three 5-a-side pitches, lit until 2 am.",
    address: "12 Street 9, Sarayat El Maadi",
  });
  await staff(owner.id, "PATCH", `${path}/settings`, { cancellationPolicy: "MODERATE" });
  await prisma.venueMedia.createMany({
    data: [0, 1, 2].map((position) => ({
      venueId,
      key: `venues/${venueId}/${position}.jpg`,
      type: "IMAGE" as const,
      contentType: "image/jpeg",
      size: 4,
      status: "READY" as const,
      position,
    })),
  });
  const ground = Ground.parse(
    await (await staff(owner.id, "POST", `${path}/grounds`, PITCH)).json(),
  );
  await staff(owner.id, "PUT", `${path}/grounds/${ground.id}/schedule`, {
    days: [{ dayOfWeek: 4, hours: [{ hour: 19, tier: "BASE" }] }],
  });
  return { ...draft, ground };
};

const statusOf = async (venueId: string) =>
  (await prisma.venue.findUniqueOrThrow({ where: { id: venueId } })).status;

const submit = async (owner: string, path: string) => {
  const res = await staff(owner, "POST", `${path}/submit`);
  expect(res.status).toBe(200);
  return VenueSetup.parse(await res.json());
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  await signIn();
});

// ---------- The owner ----------

describe("sending a venue for review", () => {
  it("lists what's still missing", async () => {
    const { owner, path } = await aDraft();
    const res = await staff(owner.id, "POST", `${path}/submit`);
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({
      code: "SETUP_INCOMPLETE",
      missing: ["DETAILS", "PHOTOS", "GROUNDS", "SCHEDULES", "SETTINGS"],
    });
  });

  it("is for the owner only", async () => {
    const { venueId, path } = await aReadyDraft();
    const manager = await createStaff({ phone: "+201009998888" });
    await addMember(venueId, manager.id, { permissions: ALL_PERMISSIONS });
    const res = await staff(manager.id, "POST", `${path}/submit`);
    expect(res.status).toBe(403);
    expect(await problem(res)).toMatchObject({ code: "OWNER_ONLY" });
  });

  it("locks the venue, tells the admins and joins the queue", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    const setup = await submit(owner.id, path);
    expect(setup.venue.status).toBe("SUBMITTED");
    expect(setup.canSubmit).toBe(false);

    const edit = await staff(owner.id, "PATCH", `${path}/settings`, { autoConfirm: false });
    expect(edit.status).toBe(409);

    const notified = await prisma.notification.findMany({ where: { adminId } });
    expect(notified).toEqual([
      expect.objectContaining({
        type: "VENUE_SUBMITTED",
        venueId,
        data: { submittedBy: owner.id },
      }),
    ]);

    const queue = list(ReviewVenue).parse(await (await admin("GET", "/venues/review")).json());
    expect(queue.data.map((venue) => venue.id)).toEqual([venueId]);

    const again = await staff(owner.id, "POST", `${path}/submit`);
    expect(await problem(again)).toMatchObject({
      code: "VENUE_STATUS_CONFLICT",
      venueStatus: "SUBMITTED",
    });
  });

  it("can be withdrawn to make changes", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    const res = await staff(owner.id, "POST", `${path}/withdraw`);
    expect(VenueSetup.parse(await res.json()).venue.status).toBe("DRAFT");
    expect(await statusOf(venueId)).toBe("DRAFT");
    expect((await staff(owner.id, "POST", `${path}/withdraw`)).status).toBe(409);
  });
});

// ---------- Admins ----------

describe("reviewing", () => {
  it("sends a venue back with a reason the owner sees, until they submit again", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    const reason = "Add photos of the pitches themselves, not only the entrance.";

    expect((await admin("POST", `/venues/${venueId}/reject`, { reason })).status).toBe(204);
    expect(await statusOf(venueId)).toBe("DRAFT");

    const setup = VenueSetup.parse(await (await staff(owner.id, "GET", `${path}/setup`)).json());
    expect(setup.rejection).toMatchObject({ reason });
    const told = await prisma.notification.findFirst({
      where: { staffId: owner.id, type: "VENUE_REJECTED" },
    });
    expect(told?.data).toEqual({ reason });

    const resubmitted = await submit(owner.id, path);
    expect(resubmitted.rejection).toBeNull();
  });

  it("needs a reason to send a venue back", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    expect((await admin("POST", `/venues/${venueId}/reject`, { reason: "No." })).status).toBe(400);
  });

  it("approves a venue into provisioning, which opens invitations but keeps the listing locked", async () => {
    const { owner, venueId, path, ground } = await aReadyDraft();
    await submit(owner.id, path);
    expect((await admin("POST", `/venues/${venueId}/approve`)).status).toBe(204);
    expect(await statusOf(venueId)).toBe("PROVISIONING");
    expect(
      await prisma.notification.count({ where: { staffId: owner.id, type: "VENUE_APPROVED" } }),
    ).toBe(1);

    const listing = await staff(owner.id, "PUT", `${path}/translations/EN`, {
      name: "Champions",
      description: null,
      address: null,
    });
    expect(listing.status).toBe(409);
    const operations = await staff(owner.id, "PATCH", `${path}/grounds/${ground.id}`, {
      basePrice: 65000,
    });
    expect(operations.status).toBe(200);
    const invite = await staff(owner.id, "POST", `${path}/invitations`, { phone: "+201005550000" });
    expect(invite.status).toBe(201);
  });

  it("only acts on venues in the right state", async () => {
    const { venueId } = await aReadyDraft();
    for (const action of ["approve", "go-live", "pause", "resume"]) {
      const res = await admin("POST", `/venues/${venueId}/${action}`);
      expect(res.status).toBe(409);
      expect(await problem(res)).toMatchObject({ venueStatus: "DRAFT" });
    }
    expect((await admin("POST", `/venues/${randomUUID()}/approve`)).status).toBe(404);
  });
});

describe("an area the owner asked for", () => {
  // A ready draft whose owner asked for an area Hagz doesn't cover, in review.
  const waitingForArea = async () => {
    const draft = await aReadyDraft();
    await prisma.venue.update({
      where: { id: draft.venueId },
      data: { locationId: null, requestedArea: "Sheikh Zayed, Giza" },
    });
    await submit(draft.owner.id, draft.path);
    const { marketplaceId } = await prisma.venue.findUniqueOrThrow({
      where: { id: draft.venueId },
    });
    return { ...draft, marketplaceId };
  };

  it("shows admins the request in place of an area", async () => {
    const { venueId } = await waitingForArea();
    const res = await admin("GET", `/venues/${venueId}`);
    expect(await res.json()).toMatchObject({ area: null, requestedArea: "Sheikh Zayed, Giza" });
  });

  it("holds approval until an admin sets an area, which replaces the request", async () => {
    const { venueId, marketplaceId } = await waitingForArea();
    const blocked = await admin("POST", `/venues/${venueId}/approve`);
    expect(blocked.status).toBe(422);
    expect(await problem(blocked)).toMatchObject({
      code: "AREA_NOT_SET",
      requestedArea: "Sheikh Zayed, Giza",
    });
    expect(await statusOf(venueId)).toBe("SUBMITTED");

    const zayed = await prisma.location.create({
      data: { marketplaceId, locality: "DISTRICT", slug: "sheikh-zayed" },
    });
    expect((await admin("PUT", `/venues/${venueId}/area`, { locationId: zayed.id })).status).toBe(
      204,
    );
    expect(await prisma.venue.findUniqueOrThrow({ where: { id: venueId } })).toMatchObject({
      locationId: zayed.id,
      requestedArea: null,
    });
    const event = await prisma.venueEvent.findFirstOrThrow({
      where: { venueId, type: "VENUE_AREA_SET" },
    });
    expect(event).toMatchObject({
      adminId,
      data: {
        previous: { locationId: null, requestedArea: "Sheikh Zayed, Giza" },
        next: { locationId: zayed.id },
      },
    });

    expect((await admin("POST", `/venues/${venueId}/approve`)).status).toBe(204);
  });

  it("only takes an area in the venue's marketplace", async () => {
    const { venueId } = await waitingForArea();
    const elsewhere = await createMarketplace();
    const dubai = await prisma.location.create({
      data: { marketplaceId: elsewhere.id, locality: "DISTRICT", slug: "al-nahda" },
    });

    const abroad = await admin("PUT", `/venues/${venueId}/area`, { locationId: dubai.id });
    expect(abroad.status).toBe(422);
    expect(await problem(abroad)).toMatchObject({ code: "LOCATION_OUTSIDE_MARKETPLACE" });
    const missing = await admin("PUT", `/venues/${venueId}/area`, { locationId: randomUUID() });
    expect(missing.status).toBe(422);
    expect(await problem(missing)).toMatchObject({ code: "LOCATION_NOT_FOUND" });

    const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    expect(venue.requestedArea).toBe("Sheikh Zayed, Giza");
  });
});

describe("going live", () => {
  const provisioning = async () => {
    const draft = await aReadyDraft();
    await submit(draft.owner.id, draft.path);
    await admin("POST", `/venues/${draft.venueId}/approve`);
    return draft;
  };

  it("needs the listing in Arabic too, which admins add", async () => {
    const { owner, venueId } = await provisioning();
    const blocked = await admin("POST", `/venues/${venueId}/go-live`);
    expect(blocked.status).toBe(422);
    expect(await problem(blocked)).toMatchObject({
      code: "GO_LIVE_BLOCKED",
      missing: ["AR_TRANSLATION"],
    });

    const arabic = await admin("PUT", `/venues/${venueId}/translations/AR`, {
      name: "ملعب الأبطال",
      description: "ثلاثة ملاعب خماسية، مضاءة حتى الثانية صباحًا.",
      address: "12 شارع 9، سرايات المعادي",
    });
    expect(arabic.status).toBe(204);

    expect((await admin("POST", `/venues/${venueId}/go-live`)).status).toBe(204);
    expect(await statusOf(venueId)).toBe("LIVE");
    expect(
      await prisma.notification.count({ where: { staffId: owner.id, type: "VENUE_LIVE" } }),
    ).toBe(1);
  });

  it("records the tax number check while provisioning", async () => {
    const { venueId } = await provisioning();
    const res = await admin("POST", `/venues/${venueId}/tax-number-check`, {
      valid: true,
      note: null,
    });
    expect(res.status).toBe(204);
    expect(
      await prisma.venueEvent.count({ where: { venueId, type: "TAX_NUMBER_CHECKED", adminId } }),
    ).toBe(1);
  });
});

describe("pausing and resuming", () => {
  const live = async () => {
    const draft = await aReadyDraft();
    await prisma.venue.update({ where: { id: draft.venueId }, data: { status: "LIVE" } });
    return draft;
  };

  it("works for the owner's team and for admins", async () => {
    const { owner, venueId, path } = await live();
    expect((await staff(owner.id, "POST", `${path}/pause`)).status).toBe(204);
    expect(await statusOf(venueId)).toBe("MAINTENANCE");
    expect((await admin("POST", `/venues/${venueId}/resume`)).status).toBe(204);
    expect((await admin("POST", `/venues/${venueId}/pause`)).status).toBe(204);
    expect((await staff(owner.id, "POST", `${path}/resume`)).status).toBe(204);
    expect(await statusOf(venueId)).toBe("LIVE");
  });

  it("won't reopen a venue without an active ground", async () => {
    const { owner, venueId, path, ground } = await live();
    await staff(owner.id, "POST", `${path}/pause`);
    await prisma.ground.update({ where: { id: ground.id }, data: { status: "MAINTENANCE" } });
    const res = await staff(owner.id, "POST", `${path}/resume`);
    expect(res.status).toBe(409);
    expect(await problem(res)).toMatchObject({ code: "NO_ACTIVE_GROUND" });
    expect(await statusOf(venueId)).toBe("MAINTENANCE");
  });
});

describe("a venue's history", () => {
  it("lists every event newest first, with who did it, a page at a time", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    await admin("POST", `/venues/${venueId}/approve`);

    const History = z.object({ data: z.array(VenueHistoryEvent), next: z.uuid().nullable() });
    const first = History.parse(
      await (await admin("GET", `/venues/${venueId}/history?limit=2`)).json(),
    );
    expect(first.data.map((event) => [event.type, event.actor.kind])).toEqual([
      ["VENUE_APPROVED", "ADMIN"],
      ["VENUE_SUBMITTED", "STAFF"],
    ]);
    expect(first.data[0]?.actor.id).toBe(adminId);
    expect(first.data[0]?.actor.name).toBeTruthy();
    expect(first.next).toBe(first.data[1]?.id);

    const rest = History.parse(
      await (
        await admin("GET", `/venues/${venueId}/history?limit=100&cursor=${first.next}`)
      ).json(),
    );
    expect(rest.data.at(-1)?.type).toBe("VENUE_CREATED");
    expect(rest.next).toBeNull();
  });
});
