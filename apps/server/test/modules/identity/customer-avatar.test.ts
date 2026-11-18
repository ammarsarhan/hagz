import { randomUUID } from "node:crypto";
import { AvatarUpload, CustomerProfile } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { sweepAvatarUploads } from "@/modules/identity/application/avatars";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import type { createInMemoryStorage } from "@/platform/storage/providers";
import { storage } from "@/platform/storage/storage";
import { resetDatabase } from "../../support/database";
import { createCustomer } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// A customer's profile photo: ask for an upload, send the file, confirm it (PR 2.3). Tests run with
// the in-memory store; `put` stands in for the app's upload.
const store = storage as ReturnType<typeof createInMemoryStorage>;

const call = async (customerId: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1/customers/me${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${await signJwt({ sub: customerId, sid: randomUUID() }, { audience: "customer", ttlSeconds: 600 })}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const JPEG = { contentType: "image/jpeg", size: 4 };
const pendingKey = async (customerId: string) =>
  (await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).avatarUploadKey;

// Asks for an upload, sends the file, confirms it.
const addAvatar = async (customerId: string) => {
  expect((await call(customerId, "POST", "/avatar", JPEG)).status).toBe(201);
  const key = await pendingKey(customerId);
  store.put(key ?? "", new Uint8Array([1, 2, 3, 4]), "image/jpeg");
  const res = await call(customerId, "POST", "/avatar/confirm");
  expect(res.status).toBe(200);
  return { key: key ?? "", profile: CustomerProfile.parse(await res.json()) };
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  store.objects.clear();
});

describe("GET /customers/me", () => {
  it("reads the signed-in customer, with no photo yet", async () => {
    const customer = await createCustomer();
    const res = await call(customer.id, "GET", "");
    expect(res.status).toBe(200);
    expect(CustomerProfile.parse(await res.json())).toEqual({
      id: customer.id,
      name: "Ahmed",
      phone: "+201001234567",
      language: "AR",
      twoFactorEnabled: false,
      avatarUrl: null,
    });
  });

  it("ends the session of a deleted account", async () => {
    const customer = await createCustomer();
    await prisma.customer.update({
      where: { id: customer.id },
      data: { deletedAt: new Date(), phone: null },
    });
    expect((await call(customer.id, "GET", "")).status).toBe(401);
  });

  it("needs a signed-in customer", async () => {
    expect((await router.request("/v1/customers/me")).status).toBe(401);
  });
});

describe("a profile photo", () => {
  it("hands out a signed upload, then becomes the photo once confirmed", async () => {
    const customer = await createCustomer();
    const res = await call(customer.id, "POST", "/avatar", JPEG);
    expect(res.status).toBe(201);
    expect(AvatarUpload.parse(await res.json())).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "Content-Length": "4" },
    });
    const key = await pendingKey(customer.id);
    expect(key).toMatch(new RegExp(`^customers/${customer.id}/[0-9a-f-]{36}\\.jpg$`));

    store.put(key ?? "", new Uint8Array([1, 2, 3, 4]), "image/jpeg");
    const confirmed = await call(customer.id, "POST", "/avatar/confirm");
    expect(confirmed.status).toBe(200);
    expect(CustomerProfile.parse(await confirmed.json()).avatarUrl).toBe(`memory://${key ?? ""}`);
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).toMatchObject({
      avatarKey: key,
      avatarUploadKey: null,
      avatarUploadAt: null,
    });
  });

  it("replaces the photo before, removing its file", async () => {
    const customer = await createCustomer();
    const first = await addAvatar(customer.id);
    const second = await addAvatar(customer.id);
    expect(second.profile.avatarUrl).toBe(`memory://${second.key}`);
    expect(store.objects.has(first.key)).toBe(false);
    expect(store.objects.has(second.key)).toBe(true);
  });

  it("replaces an upload not confirmed yet when asked again, removing its file", async () => {
    const customer = await createCustomer();
    await call(customer.id, "POST", "/avatar", JPEG);
    const first = (await pendingKey(customer.id)) ?? "";
    store.put(first, new Uint8Array([1, 2, 3, 4]), "image/jpeg");
    await call(customer.id, "POST", "/avatar", JPEG);
    expect(await pendingKey(customer.id)).not.toBe(first);
    expect(store.objects.has(first)).toBe(false);
  });

  it("refuses to confirm before the file arrives, or with nothing asked for", async () => {
    const customer = await createCustomer();
    const nothing = await call(customer.id, "POST", "/avatar/confirm");
    expect(nothing.status).toBe(409);
    expect(await nothing.json()).toMatchObject({ code: "UPLOAD_NOT_FOUND" });

    await call(customer.id, "POST", "/avatar", JPEG);
    const early = await call(customer.id, "POST", "/avatar/confirm");
    expect(early.status).toBe(409);
    expect(await pendingKey(customer.id)).not.toBeNull();
  });

  it("refuses a file that isn't an allowed image, removing it", async () => {
    const customer = await createCustomer();
    await call(customer.id, "POST", "/avatar", JPEG);
    const key = (await pendingKey(customer.id)) ?? "";
    store.put(key, new Uint8Array([1, 2, 3, 4]), "application/pdf");
    const res = await call(customer.id, "POST", "/avatar/confirm");
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "UPLOAD_MISMATCH" });
    expect(store.objects.has(key)).toBe(false);
    expect(await pendingKey(customer.id)).toBeNull();
  });

  it("refuses a type or size that isn't allowed before handing out an upload", async () => {
    const customer = await createCustomer();
    const gif = await call(customer.id, "POST", "/avatar", { contentType: "image/gif", size: 4 });
    expect(gif.status).toBe(400);
    const huge = await call(customer.id, "POST", "/avatar", {
      contentType: "image/jpeg",
      size: 6 * 1024 * 1024,
    });
    expect(huge.status).toBe(400);
  });

  it("removes the photo and its file", async () => {
    const customer = await createCustomer();
    const { key } = await addAvatar(customer.id);
    expect((await call(customer.id, "DELETE", "/avatar")).status).toBe(204);
    expect(store.objects.has(key)).toBe(false);
    const profile = CustomerProfile.parse(await (await call(customer.id, "GET", "")).json());
    expect(profile.avatarUrl).toBeNull();
    // Again: nothing to remove.
    expect((await call(customer.id, "DELETE", "/avatar")).status).toBe(204);
  });
});

describe("the sweeper", () => {
  it("removes uploads asked for more than a day ago and never confirmed", async () => {
    const stale = await createCustomer({ phone: "+201001234568" });
    const fresh = await createCustomer({ phone: "+201001234569" });
    await call(stale.id, "POST", "/avatar", JPEG);
    await call(fresh.id, "POST", "/avatar", JPEG);
    const staleKey = (await pendingKey(stale.id)) ?? "";
    store.put(staleKey, new Uint8Array([1, 2, 3, 4]), "image/jpeg");
    await prisma.customer.update({
      where: { id: stale.id },
      data: { avatarUploadAt: new Date(Date.now() - 25 * 3600 * 1000) },
    });

    expect(await sweepAvatarUploads()).toBe(1);
    expect(store.objects.has(staleKey)).toBe(false);
    expect(await pendingKey(stale.id)).toBeNull();
    expect(await pendingKey(fresh.id)).not.toBeNull();
  });
});
