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
// A draft with a 5-a-side and a 7-a-side, and three amenities: a café and parking, which can go on
// the layout, and Wi-Fi, which can't.
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
  const option = (key: string, placeable: boolean) =>
    prisma.amenityOption.create({
      data: { marketplaceId: marketplace.id, key, icon: "other", placeable },
    });
  const [cafe, parking, wifi] = [
    await option("cafe", true),
    await option("parking", true),
    await option("wifi", false),
  ];
  const offered = await call(owner.id, "PUT", `${path}/amenities`, {
    amenities: [cafe, parking, wifi].map((o) => ({ optionId: o.id, price: null, pricing: null })),
  });
  expect(offered.status).toBe(200);
  return {
    owner,
    venueId: created.venue.id,
    path,
    five,
    seven,
    cafe: cafe.id,
    parking: parking.id,
    wifi: wifi.id,
  };
};

const ids = (draft: Awaited<ReturnType<typeof aDraft>>) => ({
  five: draft.five.id,
  seven: draft.seven.id,
  cafe: draft.cafe,
  parking: draft.parking,
});

const plan = ({
  five,
  seven,
  cafe,
  parking,
}: {
  five: string;
  seven: string;
  cafe: string;
  parking: string;
}): VenueLayout => ({
  columns: 16,
  rows: 19,
  grounds: [
    { groundId: five, x: 1, y: 1, orientation: "HORIZONTAL", width: 4, height: 2 },
    { groundId: seven, x: 1, y: 5, orientation: "HORIZONTAL", width: 6, height: 4 },
  ],
  amenities: [
    { optionId: cafe, x: 9, y: 5, width: 3, height: 2 },
    { optionId: parking, x: 1, y: 14, width: 4, height: 3 },
  ],
  entrances: [{ side: "BOTTOM", offset: 8 }],
});

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("the venue layout", () => {
  it("suggests an empty grid before the first save, with every ground still to place", async () => {
    const draft = await aDraft();
    const { owner, path, five, seven } = draft;
    const view = VenueLayoutView.parse(
      await (await call(owner.id, "GET", `${path}/layout`)).json(),
    );
    expect(view).toEqual({
      columns: 16,
      rows: 19,
      grounds: [],
      amenities: [],
      entrances: [],
      saved: false,
      unplacedGroundIds: [five.id, seven.id],
      // By key: the café, then parking. Not Wi-Fi.
      placeableOptionIds: [draft.cafe, draft.parking],
    });
  });

  it("saves the whole layout and reads it back", async () => {
    const draft = await aDraft();
    const { owner, path, venueId, seven } = draft;
    const res = await call(owner.id, "PUT", `${path}/layout`, plan(ids(draft)));
    expect(res.status).toBe(200);
    const view = VenueLayoutView.parse(await res.json());
    expect(view).toEqual({
      ...plan(ids(draft)),
      saved: true,
      unplacedGroundIds: [],
      placeableOptionIds: [draft.cafe, draft.parking],
    });

    // Saving again replaces it: here, the 7-a-side comes off.
    const fewer = {
      ...plan(ids(draft)),
      grounds: plan(ids(draft)).grounds.slice(0, 1),
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
    const draft = await aDraft();
    const { owner, path, five } = draft;
    const overlapping = {
      ...plan(ids(draft)),
      amenities: [{ optionId: draft.cafe, x: 2, y: 2, width: 1, height: 1 }],
    };
    const res = await call(owner.id, "PUT", `${path}/layout`, overlapping);
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({
      code: "INVALID_LAYOUT",
      reason: "OVERLAP",
      items: [five.id, "amenity:0"],
    });

    const other = await aDraft();
    const stranger = await call(
      owner.id,
      "PUT",
      `${path}/layout`,
      plan({ ...ids(draft), seven: other.seven.id }),
    );
    expect(await problem(stranger)).toMatchObject({
      reason: "UNKNOWN_GROUND",
      groundId: other.seven.id,
    });
  });

  it("sizes grounds within their kind's range, and amenities as they like", async () => {
    const draft = await aDraft();
    const base = plan(ids(draft));
    // A 5-a-side as big as a 7-a-side, or a 7-a-side as small as a 5-a-side: no.
    for (const [index, width, height] of [
      [0, 5, 3],
      [1, 4, 2],
    ] as const) {
      const grounds = base.grounds.map((g, i) => (i === index ? { ...g, width, height } : g));
      const res = await call(draft.owner.id, "PUT", `${draft.path}/layout`, { ...base, grounds });
      expect(res.status).toBe(422);
      expect(await problem(res)).toMatchObject({ reason: "GROUND_SIZE" });
    }
    // A smaller 5-a-side and a car park bigger than the old four-cell limit: yes.
    const res = await call(draft.owner.id, "PUT", `${draft.path}/layout`, {
      ...base,
      grounds: base.grounds.map((g, i) => (i === 0 ? { ...g, width: 3 } : g)),
      amenities: [{ optionId: draft.parking, x: 1, y: 11, width: 9, height: 6 }],
    });
    expect(res.status).toBe(200);
    const view = VenueLayoutView.parse(await res.json());
    expect(view.grounds[0]).toMatchObject({ width: 3, height: 2 });
    expect(view.amenities[0]).toMatchObject({ width: 9, height: 6 });
  });

  it("places only amenities the venue offers that can go on a layout", async () => {
    const draft = await aDraft();
    for (const optionId of [draft.wifi, randomUUID()]) {
      const res = await call(draft.owner.id, "PUT", `${draft.path}/layout`, {
        ...plan(ids(draft)),
        amenities: [{ optionId, x: 9, y: 5, width: 1, height: 1 }],
      });
      expect(res.status).toBe(422);
      expect(await problem(res)).toMatchObject({ reason: "UNKNOWN_AMENITY", optionId });
    }
  });

  it("keeps an amenity's tiles while the venue offers it, and drops them when it stops", async () => {
    const draft = await aDraft();
    await call(draft.owner.id, "PUT", `${draft.path}/layout`, plan(ids(draft)));

    // The café gets a price and parking goes: the café stays put, parking comes off.
    const amenities = await call(draft.owner.id, "PUT", `${draft.path}/amenities`, {
      amenities: [
        { optionId: draft.cafe, price: 2000, pricing: "PER_BOOKING" },
        { optionId: draft.wifi, price: null, pricing: null },
      ],
    });
    expect(amenities.status).toBe(200);
    const view = VenueLayoutView.parse(
      await (await call(draft.owner.id, "GET", `${draft.path}/layout`)).json(),
    );
    expect(view.amenities).toEqual([plan(ids(draft)).amenities[0]]);
    expect(view.placeableOptionIds).toEqual([draft.cafe]);
  });

  it("completes the checklist once every ground is placed", async () => {
    const draft = await aDraft();
    const { owner, path } = draft;
    const layoutItem = async () =>
      VenueSetup.parse(await (await call(owner.id, "GET", `${path}/setup`)).json()).items.find(
        (item) => item.key === "LAYOUT",
      )?.state;
    expect(await layoutItem()).toBe("MISSING");
    await call(owner.id, "PUT", `${path}/layout`, plan(ids(draft)));
    expect(await layoutItem()).toBe("DONE");
  });

  it("can't change while the venue is in review", async () => {
    const draft = await aDraft();
    const { owner, path, venueId } = draft;
    await prisma.venue.update({ where: { id: venueId }, data: { status: "SUBMITTED" } });
    expect((await call(owner.id, "PUT", `${path}/layout`, plan(ids(draft)))).status).toBe(409);
  });
});
