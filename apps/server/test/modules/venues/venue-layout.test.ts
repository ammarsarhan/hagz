import { randomUUID } from "node:crypto";
import {
  Ground,
  VenueLayoutView,
  VenueSetup,
  type CreateGround,
  type CreateVenue,
  type VenueLayout,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createMarketplace, createStaff } from "../../support/factories";
import { resetRedis } from "../../support/redis";

const call = async (staffId: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1/staff${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${await signJwt({ sub: staffId, sid: randomUUID() }, { audience: "staff", ttlSeconds: 600 })}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const problem = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  delete body.requestId;
  return body;
};

const PITCH: CreateGround = {
  name: "Pitch",
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
// A draft with a 5-a-side and a 7-a-side.
const aDraft = async () => {
  const marketplace = await createMarketplace();
  const area = await prisma.location.create({
    data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: `maadi-${phones}` },
  });
  const owner = await createStaff({ phone: `+2010066${String(phones++).padStart(5, "0")}` });
  const body: CreateVenue = {
    name: "Champions Arena",
    coordinates: { latitude: 29.96, longitude: 31.25 },
    locationId: area.id,
  };
  const created = VenueSetup.parse(await (await call(owner.id, "POST", "/venues", body)).json());
  const path = `/venues/${created.venue.id}`;
  const ground = async (size: CreateGround["size"]) =>
    Ground.parse(
      await (await call(owner.id, "POST", `${path}/grounds`, { ...PITCH, size })).json(),
    );
  const [five, seven] = [await ground("FIVE_A_SIDE"), await ground("SEVEN_A_SIDE")];
  return { owner, venueId: created.venue.id, path, five, seven };
};

const plan = (five: string, seven: string): VenueLayout => ({
  columns: 16,
  rows: 19,
  grounds: [
    { groundId: five, x: 1, y: 1, orientation: "HORIZONTAL" },
    { groundId: seven, x: 1, y: 5, orientation: "HORIZONTAL" },
  ],
  facilities: [
    { type: "CAFE", x: 9, y: 5, width: 3, height: 2 },
    { type: "PARKING", x: 1, y: 14, width: 4, height: 3 },
  ],
  entrances: [{ side: "BOTTOM", offset: 8 }],
});

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("the venue layout", () => {
  it("suggests an empty grid before the first save, with every ground still to place", async () => {
    const { owner, path, five, seven } = await aDraft();
    const view = VenueLayoutView.parse(
      await (await call(owner.id, "GET", `${path}/layout`)).json(),
    );
    expect(view).toEqual({
      columns: 16,
      rows: 19,
      grounds: [],
      facilities: [],
      entrances: [],
      saved: false,
      unplacedGroundIds: [five.id, seven.id],
    });
  });

  it("saves the whole layout and reads it back", async () => {
    const { owner, path, venueId, five, seven } = await aDraft();
    const res = await call(owner.id, "PUT", `${path}/layout`, plan(five.id, seven.id));
    expect(res.status).toBe(200);
    const view = VenueLayoutView.parse(await res.json());
    expect(view).toEqual({ ...plan(five.id, seven.id), saved: true, unplacedGroundIds: [] });

    // Saving again replaces it: here, the 7-a-side comes off.
    const fewer = {
      ...plan(five.id, seven.id),
      grounds: plan(five.id, seven.id).grounds.slice(0, 1),
    };
    const again = VenueLayoutView.parse(
      await (await call(owner.id, "PUT", `${path}/layout`, fewer)).json(),
    );
    expect(again.unplacedGroundIds).toEqual([seven.id]);
    expect(
      await prisma.venueEvent.count({ where: { venueId, type: "VENUE_LAYOUT_CHANGED" } }),
    ).toBe(2);
  });

  it("names what's wrong with a layout it refuses", async () => {
    const { owner, path, five, seven } = await aDraft();
    const overlapping = {
      ...plan(five.id, seven.id),
      facilities: [{ type: "CAFE", x: 2, y: 2, width: 1, height: 1 }],
    };
    const res = await call(owner.id, "PUT", `${path}/layout`, overlapping);
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({
      code: "INVALID_LAYOUT",
      reason: "OVERLAP",
      items: [five.id, "facility:0"],
    });

    const other = await aDraft();
    const stranger = await call(owner.id, "PUT", `${path}/layout`, plan(five.id, other.seven.id));
    expect(await problem(stranger)).toMatchObject({
      reason: "UNKNOWN_GROUND",
      groundId: other.seven.id,
    });
  });

  it("completes the checklist once every ground is placed", async () => {
    const { owner, path, five, seven } = await aDraft();
    const layoutItem = async () =>
      VenueSetup.parse(await (await call(owner.id, "GET", `${path}/setup`)).json()).items.find(
        (item) => item.key === "LAYOUT",
      )?.state;
    expect(await layoutItem()).toBe("MISSING");
    await call(owner.id, "PUT", `${path}/layout`, plan(five.id, seven.id));
    expect(await layoutItem()).toBe("DONE");
  });

  it("can't change while the venue is in review", async () => {
    const { owner, path, venueId, five, seven } = await aDraft();
    await prisma.venue.update({ where: { id: venueId }, data: { status: "SUBMITTED" } });
    expect((await call(owner.id, "PUT", `${path}/layout`, plan(five.id, seven.id))).status).toBe(
      409,
    );
  });
});
