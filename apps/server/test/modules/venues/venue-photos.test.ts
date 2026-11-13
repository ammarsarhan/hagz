import { randomUUID } from "node:crypto";
import { PhotoUpload, VenuePhoto, VenueSetup, list, type CreateVenue } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { sweepPendingPhotos } from "@/modules/venues/application/venue-media";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import type { createInMemoryStorage } from "@/platform/storage/providers";
import { storage } from "@/platform/storage/storage";
import { resetDatabase } from "../../support/database";
import { createMarketplace, createStaff } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Tests run with the in-memory store; `put` stands in for the app's upload.
const store = storage as ReturnType<typeof createInMemoryStorage>;

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

let phones = 0;
const aDraft = async () => {
  const marketplace = await createMarketplace();
  const area = await prisma.location.create({
    data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: `maadi-${phones}` },
  });
  const owner = await createStaff({ phone: `+2010044${String(phones++).padStart(5, "0")}` });
  const body: CreateVenue = {
    name: "Champions Arena",
    coordinates: { latitude: 29.96, longitude: 31.25 },
    locationId: area.id,
  };
  const created = VenueSetup.parse(await (await call(owner.id, "POST", "/venues", body)).json());
  return { owner, venueId: created.venue.id, path: `/venues/${created.venue.id}` };
};

const JPEG = { contentType: "image/jpeg", size: 4 };
const keyOf = (photoId: string) =>
  prisma.venueMedia.findUniqueOrThrow({ where: { id: photoId } }).then((media) => media.key);

// Asks for an upload, sends the file, confirms it.
const addPhoto = async (owner: string, path: string) => {
  const { photo } = PhotoUpload.parse(
    await (await call(owner, "POST", `${path}/photos`, JPEG)).json(),
  );
  store.put(await keyOf(photo.id), new Uint8Array([1, 2, 3, 4]), "image/jpeg");
  const res = await call(owner, "POST", `${path}/photos/${photo.id}/confirm`);
  expect(res.status).toBe(200);
  return VenuePhoto.parse(await res.json());
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  store.objects.clear();
});

describe("uploading a photo", () => {
  it("hands out a signed upload, then puts the photo on the venue once confirmed", async () => {
    const { owner, path, venueId } = await aDraft();
    const res = await call(owner.id, "POST", `${path}/photos`, JPEG);
    expect(res.status).toBe(201);
    const { photo, upload } = PhotoUpload.parse(await res.json());
    expect(photo).toMatchObject({ status: "PENDING", position: 0 });
    expect(upload).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "Content-Length": "4" },
    });
    const key = await keyOf(photo.id);
    expect(key).toMatch(new RegExp(`^venues/${venueId}/[0-9a-f-]{36}\\.jpg$`));

    const early = await call(owner.id, "POST", `${path}/photos/${photo.id}/confirm`);
    expect(early.status).toBe(409);
    expect(await problem(early)).toMatchObject({ code: "UPLOAD_NOT_FOUND" });

    store.put(key, new Uint8Array([1, 2, 3, 4]), "image/jpeg");
    const confirmed = VenuePhoto.parse(
      await (await call(owner.id, "POST", `${path}/photos/${photo.id}/confirm`)).json(),
    );
    expect(confirmed).toMatchObject({ id: photo.id, status: "READY", url: `memory://${key}` });

    // Confirming twice is harmless and records the photo once.
    expect((await call(owner.id, "POST", `${path}/photos/${photo.id}/confirm`)).status).toBe(200);
    expect(await prisma.venueEvent.count({ where: { venueId, type: "VENUE_PHOTO_ADDED" } })).toBe(
      1,
    );
  });

  it("throws away a file of another type than declared", async () => {
    const { owner, path } = await aDraft();
    const { photo } = PhotoUpload.parse(
      await (await call(owner.id, "POST", `${path}/photos`, JPEG)).json(),
    );
    const key = await keyOf(photo.id);
    store.put(key, new Uint8Array([1, 2, 3, 4]), "text/html");
    const res = await call(owner.id, "POST", `${path}/photos/${photo.id}/confirm`);
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({ code: "UPLOAD_MISMATCH" });
    expect(await store.head(key)).toBeNull();
  });

  it("throws away a file of another size than declared", async () => {
    const { owner, path } = await aDraft();
    const { photo } = PhotoUpload.parse(
      await (await call(owner.id, "POST", `${path}/photos`, JPEG)).json(),
    );
    const key = await keyOf(photo.id);
    store.put(key, new Uint8Array([1, 2, 3, 4, 5, 6]), "image/jpeg");
    const res = await call(owner.id, "POST", `${path}/photos/${photo.id}/confirm`);
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({ code: "UPLOAD_MISMATCH" });
    expect(await store.head(key)).toBeNull();
    expect((await prisma.venueMedia.findUniqueOrThrow({ where: { id: photo.id } })).status).toBe(
      "PENDING",
    );
  });

  it("takes JPEG, PNG and WebP up to 10 MB", async () => {
    const { owner, path } = await aDraft();
    for (const body of [
      { contentType: "image/gif", size: 4 },
      { contentType: "image/jpeg", size: 10 * 1024 * 1024 + 1 },
    ]) {
      expect((await call(owner.id, "POST", `${path}/photos`, body)).status).toBe(400);
    }
    expect(
      (await call(owner.id, "POST", `${path}/photos`, { contentType: "image/webp", size: 4 }))
        .status,
    ).toBe(201);
  });

  it("stops at 20 photos", async () => {
    const { owner, path, venueId } = await aDraft();
    await prisma.venueMedia.createMany({
      data: Array.from({ length: 20 }, (_, position) => ({
        venueId,
        key: `venues/${venueId}/${position}.jpg`,
        type: "IMAGE" as const,
        contentType: "image/jpeg",
        size: 4,
        status: "READY" as const,
        position,
      })),
    });
    const res = await call(owner.id, "POST", `${path}/photos`, JPEG);
    expect(res.status).toBe(409);
    expect(await problem(res)).toMatchObject({ code: "PHOTO_LIMIT_REACHED" });
  });
});

describe("arranging photos", () => {
  it("reorders them, the first becoming the cover", async () => {
    const { owner, path } = await aDraft();
    const [a, b, c] = [
      await addPhoto(owner.id, path),
      await addPhoto(owner.id, path),
      await addPhoto(owner.id, path),
    ];
    const res = await call(owner.id, "PUT", `${path}/photos/order`, {
      photoIds: [c.id, a.id, b.id],
    });
    expect(res.status).toBe(200);
    const { data } = list(VenuePhoto).parse(await res.json());
    expect(data.map((photo) => [photo.id, photo.position])).toEqual([
      [c.id, 0],
      [a.id, 1],
      [b.id, 2],
    ]);

    const partial = await call(owner.id, "PUT", `${path}/photos/order`, { photoIds: [c.id, a.id] });
    expect(partial.status).toBe(422);
    expect(await problem(partial)).toMatchObject({ code: "INVALID_PHOTO_ORDER" });
  });

  it("removes a photo and its file", async () => {
    const { owner, path } = await aDraft();
    const photo = await addPhoto(owner.id, path);
    const key = await keyOf(photo.id);
    expect((await call(owner.id, "DELETE", `${path}/photos/${photo.id}`)).status).toBe(204);
    expect(await store.head(key)).toBeNull();
    expect((await call(owner.id, "DELETE", `${path}/photos/${photo.id}`)).status).toBe(404);
  });

  it("completes the checklist item at three", async () => {
    const { owner, path } = await aDraft();
    const photosItem = async () =>
      VenueSetup.parse(await (await call(owner.id, "GET", `${path}/setup`)).json()).items.find(
        (item) => item.key === "PHOTOS",
      )?.state;
    await addPhoto(owner.id, path);
    await addPhoto(owner.id, path);
    expect(await photosItem()).toBe("MISSING");
    await addPhoto(owner.id, path);
    expect(await photosItem()).toBe("DONE");
  });

  it("is part of the listing, locked in review and while provisioning", async () => {
    const { owner, path, venueId } = await aDraft();
    const photo = await addPhoto(owner.id, path);
    for (const status of ["SUBMITTED", "PROVISIONING"] as const) {
      await prisma.venue.update({ where: { id: venueId }, data: { status } });
      for (const [method, url, body] of [
        ["POST", `${path}/photos`, JPEG],
        ["PUT", `${path}/photos/order`, { photoIds: [photo.id] }],
        ["DELETE", `${path}/photos/${photo.id}`, undefined],
      ] as const) {
        const res = await call(owner.id, method, url, body);
        expect(res.status).toBe(409);
        expect(await problem(res)).toMatchObject({ code: "VENUE_STATUS_CONFLICT" });
      }
    }
  });
});

describe("the sweeper", () => {
  it("removes uploads never confirmed after a day, and leaves the rest", async () => {
    const { owner, path } = await aDraft();
    const kept = await addPhoto(owner.id, path);
    const { photo: abandoned } = PhotoUpload.parse(
      await (await call(owner.id, "POST", `${path}/photos`, JPEG)).json(),
    );
    const abandonedKey = await keyOf(abandoned.id);
    store.put(abandonedKey, new Uint8Array([1]), "image/jpeg");

    expect(await sweepPendingPhotos()).toBe(0);
    const tomorrow = { now: () => new Date(Date.now() + 25 * 3600 * 1000) };
    expect(await sweepPendingPhotos(tomorrow)).toBe(1);
    expect(await prisma.venueMedia.findMany({ select: { id: true } })).toEqual([{ id: kept.id }]);
    expect(await store.head(abandonedKey)).toBeNull();
  });
});
