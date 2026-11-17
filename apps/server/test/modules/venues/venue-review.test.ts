import { randomUUID } from "node:crypto";
import {
  AdminVenueOverview,
  Ground,
  ReviewVenue,
  StaffInvitation,
  VenueHistoryEvent,
  VenueMember,
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
import {
  addMember,
  createAdmin,
  createMarketplace,
  createStaff,
  setCentre,
} from "../../support/factories";
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

// Live without going through provisioning, for tests about what a running venue can do (inviting
// staff): going live itself is tested under "going live".
const markLive = (venueId: string) =>
  prisma.venue.update({ where: { id: venueId }, data: { status: "LIVE" } });

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
    const before = Date.now();
    const setup = await submit(owner.id, path);
    expect(setup.venue.status).toBe("SUBMITTED");
    expect(setup.canSubmit).toBe(false);
    // Since when, for the in-review screen's "Sent for review".
    expect(Date.parse(setup.venue.submittedAt ?? "")).toBeGreaterThanOrEqual(before - 1000);

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
    const draft = VenueSetup.parse(await res.json());
    expect(draft.venue.status).toBe("DRAFT");
    expect(draft.venue.submittedAt).toBeNull();
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

  it("holds a venue sent back with sections to change until each is edited", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    const reason = "Choose a stricter policy, and add the VAT number from your invoices.";
    const sentBack = await admin("POST", `/venues/${venueId}/reject`, {
      reason,
      items: ["SETTINGS", "TAX_NUMBER"],
    });
    expect(sentBack.status).toBe(204);

    const setupOf = async () =>
      VenueSetup.parse(await (await staff(owner.id, "GET", `${path}/setup`)).json());
    const flagged = (setup: VenueSetup) =>
      setup.items.filter((item) => item.needsChanges).map((item) => item.key);

    const setup = await setupOf();
    expect(setup.rejection).toMatchObject({ reason, items: ["SETTINGS", "TAX_NUMBER"] });
    expect(flagged(setup)).toEqual(["SETTINGS", "TAX_NUMBER"]);
    expect(setup.canSubmit).toBe(false);

    const early = await staff(owner.id, "POST", `${path}/submit`);
    expect(early.status).toBe(422);
    expect(await problem(early)).toMatchObject({
      code: "CHANGES_NEEDED",
      items: ["SETTINGS", "TAX_NUMBER"],
    });

    // Saving the policy it already has changes nothing, and the phone isn't the tax number.
    await staff(owner.id, "PATCH", `${path}/settings`, { cancellationPolicy: "MODERATE" });
    await staff(owner.id, "PATCH", path, { phone: "+20 2 2358 1111" });
    expect(flagged(await setupOf())).toEqual(["SETTINGS", "TAX_NUMBER"]);

    await staff(owner.id, "PATCH", `${path}/settings`, { cancellationPolicy: "STRICT" });
    expect(flagged(await setupOf())).toEqual(["TAX_NUMBER"]);
    await staff(owner.id, "PATCH", path, { taxNumber: "512-334-981" });
    const ready = await setupOf();
    expect(flagged(ready)).toEqual([]);
    expect(ready.canSubmit).toBe(true);

    expect((await submit(owner.id, path)).venue.status).toBe("SUBMITTED");
  });

  it("doesn't count a section changed and changed back", async () => {
    const { owner, venueId, path, ground } = await aReadyDraft();
    await submit(owner.id, path);
    await admin("POST", `/venues/${venueId}/reject`, {
      reason: "The pitch is covered: mark it indoor.",
      items: ["GROUNDS", "SETTINGS"],
    });
    const flagged = async () =>
      VenueSetup.parse(await (await staff(owner.id, "GET", `${path}/setup`)).json())
        .items.filter((item) => item.needsChanges)
        .map((item) => item.key);
    const groundPath = `${path}/grounds/${ground.id}`;

    // Indoor and back to outdoor; a stricter policy and back to the one it had.
    await staff(owner.id, "PATCH", groundPath, { environment: "INDOOR" });
    await staff(owner.id, "PATCH", groundPath, { environment: "OUTDOOR" });
    await staff(owner.id, "PATCH", `${path}/settings`, { cancellationPolicy: "STRICT" });
    await staff(owner.id, "PATCH", `${path}/settings`, { cancellationPolicy: "MODERATE" });
    expect(await flagged()).toEqual(["GROUNDS", "SETTINGS"]);
    const early = await staff(owner.id, "POST", `${path}/submit`);
    expect(await problem(early)).toMatchObject({ code: "CHANGES_NEEDED" });

    await staff(owner.id, "PATCH", groundPath, { environment: "INDOOR" });
    expect(await flagged()).toEqual(["SETTINGS"]);
  });

  it("only takes setup sections to change, each once", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    const reason = "Retake the photos in daylight, please.";
    for (const items of [["PRICES"], ["PHOTOS", "PHOTOS"]]) {
      const res = await admin("POST", `/venues/${venueId}/reject`, { reason, items });
      expect(res.status).toBe(400);
    }
  });

  it("needs a reason to send a venue back", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    expect((await admin("POST", `/venues/${venueId}/reject`, { reason: "No." })).status).toBe(400);
  });

  it("approves a venue into provisioning, which keeps the listing and invitations locked", async () => {
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
    // Staff join once it's live.
    const invite = await staff(owner.id, "POST", `${path}/invitations`, { phone: "+201005550000" });
    expect(invite.status).toBe(409);
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

  it("only takes an area near the venue's pin", async () => {
    const { venueId, marketplaceId } = await waitingForArea();
    // The pin is in Maadi; Smouha is in Alexandria.
    const smouha = await prisma.location.create({
      data: { marketplaceId, locality: "DISTRICT", slug: "smouha" },
    });
    await setCentre(smouha.id, { latitude: 31.2155, longitude: 29.942 });

    const far = await admin("PUT", `/venues/${venueId}/area`, { locationId: smouha.id });
    expect(far.status).toBe(422);
    expect(await problem(far)).toMatchObject({ code: "PIN_FAR_FROM_AREA", areaId: smouha.id });
    const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    expect(venue).toMatchObject({ locationId: null, requestedArea: "Sheikh Zayed, Giza" });
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

describe("a venue's team", () => {
  it("lists the staff, owner first, and the invitations still open", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await submit(owner.id, path);
    await admin("POST", `/venues/${venueId}/approve`);
    await markLive(venueId);
    const invite = await staff(owner.id, "POST", `${path}/invitations`, { phone: "+201005550000" });
    expect(invite.status).toBe(201);

    const members = list(VenueMember).parse(
      await (await admin("GET", `/venues/${venueId}/members`)).json(),
    );
    expect(members.data.map((m) => [m.staffId, m.role])).toEqual([[owner.id, "OWNER"]]);

    const invitations = list(StaffInvitation).parse(
      await (await admin("GET", `/venues/${venueId}/invitations`)).json(),
    );
    expect(invitations.data).toHaveLength(1);
    expect(invitations.data[0]?.phone).toBe("+201005550000");
  });

  it("is a 404 for a venue that isn't there", async () => {
    for (const list of ["members", "invitations"]) {
      expect((await admin("GET", `/venues/${randomUUID()}/${list}`)).status).toBe(404);
    }
  });
});

describe("admin support on a venue's team", () => {
  const REASON = { reason: "The owner called support and asked for this." };

  // A venue in provisioning (so it can have invitations) with a second member who manages everything.
  const aTeam = async () => {
    const draft = await aReadyDraft();
    await submit(draft.owner.id, draft.path);
    await admin("POST", `/venues/${draft.venueId}/approve`);
    const member = await createStaff({ phone: "+201009998888" });
    await addMember(draft.venueId, member.id, { permissions: ALL_PERMISSIONS });
    return { ...draft, member };
  };

  const membersOf = async (venueId: string) =>
    list(VenueMember).parse(await (await admin("GET", `/venues/${venueId}/members`)).json()).data;

  it("removes a member, keeps the owner, and records who did it and why", async () => {
    const { owner, member, venueId, path } = await aTeam();

    const res = await admin("POST", `/venues/${venueId}/members/${member.id}/remove`, REASON);
    expect(res.status).toBe(204);
    expect((await membersOf(venueId)).map((m) => m.staffId)).toEqual([owner.id]);
    // Gone from the venue at once, with the token they still hold.
    expect((await staff(member.id, "GET", `${path}/members`)).status).toBe(404);
    expect(
      await prisma.venueEvent.findFirst({ where: { venueId, type: "STAFF_REMOVED" } }),
    ).toMatchObject({ adminId, data: { staffId: member.id, reason: REASON.reason } });
    expect(
      await prisma.notification.count({ where: { staffId: member.id, type: "STAFF_REMOVED" } }),
    ).toBe(1);

    const theOwner = await admin("POST", `/venues/${venueId}/members/${owner.id}/remove`, REASON);
    expect(theOwner.status).toBe(409);
    expect(await problem(theOwner)).toMatchObject({ code: "OWNER_CANT_BE_REMOVED" });
    expect(
      (await admin("POST", `/venues/${venueId}/members/${member.id}/remove`, REASON)).status,
    ).toBe(404);
    expect(
      (await admin("POST", `/venues/${venueId}/members/${owner.id}/remove`, { reason: "no" }))
        .status,
    ).toBe(400);
  });

  it("revokes an open invitation", async () => {
    const { owner, venueId, path } = await aTeam();
    await markLive(venueId);
    await staff(owner.id, "POST", `${path}/invitations`, { phone: "+201005550000" });
    const [invitation] = list(StaffInvitation).parse(
      await (await admin("GET", `/venues/${venueId}/invitations`)).json(),
    ).data;

    const res = await admin("DELETE", `/venues/${venueId}/invitations/${invitation?.id}`);
    expect(res.status).toBe(204);
    expect(
      list(StaffInvitation).parse(
        await (await admin("GET", `/venues/${venueId}/invitations`)).json(),
      ).data,
    ).toEqual([]);
    expect(
      await prisma.venueEvent.findFirst({ where: { venueId, type: "STAFF_INVITATION_REVOKED" } }),
    ).toMatchObject({ adminId, staffId: null });
    // Already revoked: nothing more to do.
    expect((await admin("DELETE", `/venues/${venueId}/invitations/${invitation?.id}`)).status).toBe(
      204,
    );
  });

  it("hands the venue to another member, who becomes the owner, and keeps the old one on", async () => {
    const { owner, member, venueId } = await aTeam();

    const res = await admin("POST", `/venues/${venueId}/owner`, { staffId: member.id, ...REASON });
    expect(res.status).toBe(204);
    const members = await membersOf(venueId);
    expect(members.map((m) => [m.staffId, m.role])).toEqual([
      [member.id, "OWNER"],
      [owner.id, "MEMBER"],
    ]);
    expect(members[1]?.permissions).toEqual(ALL_PERMISSIONS);
    expect(
      await prisma.venueEvent.findFirst({ where: { venueId, type: "OWNERSHIP_TRANSFERRED" } }),
    ).toMatchObject({ adminId, data: { fromStaffId: owner.id, toStaffId: member.id } });
    expect(await prisma.notification.count({ where: { type: "OWNERSHIP_TRANSFERRED" } })).toBe(2);

    const again = await admin("POST", `/venues/${venueId}/owner`, {
      staffId: member.id,
      ...REASON,
    });
    expect(await problem(again)).toMatchObject({ code: "ALREADY_OWNER" });
    const stranger = await admin("POST", `/venues/${venueId}/owner`, {
      staffId: randomUUID(),
      ...REASON,
    });
    expect(stranger.status).toBe(404);
  });

  it("won't give someone a second venue that isn't live yet", async () => {
    const { member, venueId } = await aTeam();
    const { locationId } = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    const own = await staff(member.id, "POST", "/venues", {
      name: "Their Own Pitch",
      coordinates: { latitude: 29.96, longitude: 31.25 },
      locationId,
    });
    expect(own.status).toBe(201);

    const res = await admin("POST", `/venues/${venueId}/owner`, { staffId: member.id, ...REASON });
    expect(res.status).toBe(409);
    expect(await problem(res)).toMatchObject({ code: "UNFINISHED_VENUE_EXISTS" });
  });

  it("suspends a staff account everywhere at once, and reactivates it", async () => {
    const { member, venueId, path } = await aTeam();
    await prisma.staffSession.create({
      data: {
        staffId: member.id,
        refreshTokenHash: "a-hash",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    expect((await admin("POST", `/staff/${member.id}/suspend`, REASON)).status).toBe(204);
    expect((await membersOf(venueId)).find((m) => m.staffId === member.id)?.status).toBe(
      "SUSPENDED",
    );
    expect(
      await prisma.staffSession.count({ where: { staffId: member.id, revokedAt: null } }),
    ).toBe(0);
    const locked = await staff(member.id, "GET", `${path}/members`);
    expect(await problem(locked)).toMatchObject({ code: "ACCOUNT_SUSPENDED" });
    // Suspending again records nothing more.
    await admin("POST", `/staff/${member.id}/suspend`, REASON);
    expect(await prisma.venueEvent.count({ where: { venueId, type: "STAFF_SUSPENDED" } })).toBe(1);

    expect((await admin("POST", `/staff/${member.id}/reactivate`)).status).toBe(204);
    expect((await staff(member.id, "GET", `${path}/members`)).status).toBe(200);
    expect(
      await prisma.venueEvent.findFirst({ where: { venueId, type: "STAFF_REACTIVATED" } }),
    ).toMatchObject({ adminId, data: { staffId: member.id } });
    expect((await admin("POST", `/staff/${randomUUID()}/suspend`, REASON)).status).toBe(404);
  });

  it("bans for good, but not someone who still owns a venue", async () => {
    const { owner, member, venueId, path } = await aTeam();

    const ownerBan = await admin("POST", `/staff/${owner.id}/ban`, REASON);
    expect(ownerBan.status).toBe(409);
    expect(await problem(ownerBan)).toMatchObject({ code: "OWNS_A_VENUE", venueIds: [venueId] });

    expect((await admin("POST", `/staff/${member.id}/ban`, REASON)).status).toBe(204);
    expect((await membersOf(venueId)).find((m) => m.staffId === member.id)?.status).toBe("BANNED");
    const locked = await staff(member.id, "GET", `${path}/members`);
    expect(locked.status).toBe(403);
    expect(
      await prisma.venueEvent.findFirst({ where: { venueId, type: "STAFF_BANNED" } }),
    ).toMatchObject({ adminId, data: { staffId: member.id, reason: REASON.reason } });
    // There's no way back.
    for (const action of ["reactivate", "suspend"]) {
      const res = await admin("POST", `/staff/${member.id}/${action}`, REASON);
      expect(await problem(res)).toMatchObject({ code: "ACCOUNT_BANNED" });
    }
  });
});

describe("a venue's overview", () => {
  const overview = async (venueId: string) =>
    AdminVenueOverview.parse(await (await admin("GET", `/venues/${venueId}/overview`)).json());

  it("follows the venue from draft to provisioning", async () => {
    const { owner, venueId, path } = await aReadyDraft();

    const draft = await overview(venueId);
    expect(draft.setup.required.done).toBe(draft.setup.required.total);
    expect(draft.submittedAt).toBeNull();
    expect(draft.rejection).toBeNull();

    await submit(owner.id, path);
    expect((await overview(venueId)).submittedAt).not.toBeNull();

    await admin("POST", `/venues/${venueId}/reject`, {
      reason: "Add photos of the pitches themselves.",
    });
    expect((await overview(venueId)).rejection).toMatchObject({
      reason: "Add photos of the pitches themselves.",
    });

    await submit(owner.id, path);
    await admin("POST", `/venues/${venueId}/approve`);
    // The owner wrote the listing in English; the admin writes the Arabic.
    expect((await overview(venueId)).goLive).toEqual(["AR_TRANSLATION"]);
  });

  it("keeps a tax number check for that number only", async () => {
    const { owner, venueId, path } = await aReadyDraft();
    await staff(owner.id, "PATCH", path, { taxNumber: "100-200-300" });
    await submit(owner.id, path);
    await admin("POST", `/venues/${venueId}/approve`);
    expect((await overview(venueId)).taxNumber).toEqual({ value: "100-200-300", check: null });

    await admin("POST", `/venues/${venueId}/tax-number-check`, { valid: false, note: "Not found" });
    expect((await overview(venueId)).taxNumber.check).toMatchObject({
      valid: false,
      note: "Not found",
    });

    await prisma.venue.update({ where: { id: venueId }, data: { taxNumber: "999-888-777" } });
    expect((await overview(venueId)).taxNumber).toEqual({ value: "999-888-777", check: null });
    expect((await admin("GET", `/venues/${randomUUID()}/overview`)).status).toBe(404);
  });
});
