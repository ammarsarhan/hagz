import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { devStorage } from "@/http/dev-storage";
import { createInMemoryStorage, createLocalDiskStorage } from "@/platform/storage/providers";
import { selectStorage } from "@/platform/storage/storage";

const bucket = {
  STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  STORAGE_BUCKET: "hagz-media",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  STORAGE_PUBLIC_URL: "https://media.hagz.app",
};
const none = {
  STORAGE_ENDPOINT: undefined,
  STORAGE_BUCKET: undefined,
  STORAGE_ACCESS_KEY_ID: undefined,
  STORAGE_SECRET_ACCESS_KEY: undefined,
  STORAGE_PUBLIC_URL: undefined,
};

describe("choosing a store", () => {
  it.each([
    [{ NODE_ENV: "test", APP_ENV: "development", ...bucket }, "memory"],
    [{ NODE_ENV: "development", APP_ENV: "development", ...bucket }, "s3"],
    [{ NODE_ENV: "production", APP_ENV: "production", ...bucket }, "s3"],
    [{ NODE_ENV: "development", APP_ENV: "development", ...none }, "local-disk"],
    [{ NODE_ENV: "production", APP_ENV: "staging", ...none }, "unconfigured"],
  ] as const)("%j → %s", (config, name) => {
    expect(selectStorage({ PORT: 3000, ...config }).name).toBe(name);
  });

  it("signs uploads to the bucket for one type and size", async () => {
    const s3 = selectStorage({
      NODE_ENV: "production",
      APP_ENV: "production",
      PORT: 3000,
      ...bucket,
    });
    const target = await s3.uploadTarget(
      "venues/v/photo.jpg",
      { contentType: "image/jpeg", size: 1234 },
      600,
    );
    expect(target.method).toBe("PUT");
    expect(target.url).toMatch(/^https:\/\/(hagz-media\.)?account\.r2\.cloudflarestorage\.com\//);
    expect(target.url).toContain("X-Amz-Signature=");
    expect(target.headers).toEqual({ "Content-Type": "image/jpeg", "Content-Length": "1234" });
    expect(s3.publicUrl("venues/v/photo.jpg")).toBe("https://media.hagz.app/venues/v/photo.jpg");
  });

  it("refuses uploads where nothing is set up", async () => {
    const store = selectStorage({
      NODE_ENV: "production",
      APP_ENV: "staging",
      PORT: 3000,
      ...none,
    });
    await expect(
      store.uploadTarget("k", { contentType: "image/jpeg", size: 1 }, 60),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE", status: 503 });
  });
});

describe("in-memory store", () => {
  it("keeps what was put until it's removed", async () => {
    const store = createInMemoryStorage();
    expect(await store.head("a.jpg")).toBeNull();
    store.put("a.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");
    expect(await store.head("a.jpg")).toEqual({ size: 3, contentType: "image/jpeg" });
    await store.remove("a.jpg");
    expect(await store.head("a.jpg")).toBeNull();
  });
});

describe("local disk store and its dev route", () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  const disk = async () => {
    root = await mkdtemp(path.join(tmpdir(), "hagz-storage-"));
    return createLocalDiskStorage(root, "http://localhost:3000");
  };

  it("takes an upload through the route and serves it back", async () => {
    const store = await disk();
    const target = await store.uploadTarget(
      "venues/v/a.jpg",
      { contentType: "image/jpeg", size: 4 },
      60,
    );
    expect(target.url).toBe("http://localhost:3000/v1/dev/storage/venues/v/a.jpg");

    const app = devStorage(store);
    const put = await app.request("/v1/dev/storage/venues/v/a.jpg", {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array([9, 8, 7, 6]),
    });
    expect(put.status).toBe(200);
    expect(await store.head("venues/v/a.jpg")).toEqual({ size: 4, contentType: "image/jpeg" });

    const get = await app.request("/v1/dev/storage/venues/v/a.jpg");
    expect(get.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7, 6]));

    await store.remove("venues/v/a.jpg");
    expect((await app.request("/v1/dev/storage/venues/v/a.jpg")).status).toBe(404);
  });

  it("keeps keys inside its folder", async () => {
    const store = await disk();
    await expect(
      store.write("../outside.jpg", new Uint8Array([1]), "image/jpeg"),
    ).rejects.toThrow();
  });
});
