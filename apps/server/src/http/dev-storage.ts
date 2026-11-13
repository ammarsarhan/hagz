import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { createLocalDiskStorage } from "@/platform/storage/providers";
import { storage } from "@/platform/storage/storage";

// Development only: stands in for the bucket when photos are stored on disk, so the app can upload
// to and show files from the URLs the API hands out. Mounted only with the local-disk store.
type LocalDisk = ReturnType<typeof createLocalDiskStorage>;

export const MAXIMUM_DEV_UPLOAD = 10 * 1024 * 1024;

export const devStorage = (disk: LocalDisk) =>
  new Hono()
    .put(
      "/*",
      bodyLimit({
        maxSize: MAXIMUM_DEV_UPLOAD,
        onError: () => {
          throw new HTTPException(413, { message: "Files are limited to 10 MB." });
        },
      }),
      async (c) => {
        const key = c.req.path.replace(/^\/v1\/dev\/storage\//, "");
        const contentType = c.req.header("content-type") ?? "application/octet-stream";
        await disk.write(key, new Uint8Array(await c.req.arrayBuffer()), contentType);
        return c.body(null, 200);
      },
    )
    .get("/*", async (c) => {
      const key = c.req.path.replace(/^\/v1\/dev\/storage\//, "");
      const file = await disk.read(key);
      if (!file) return c.notFound();
      return c.body(new Uint8Array(file.bytes), 200, { "Content-Type": file.contentType });
    });

export const localDisk = storage.name === "local-disk" ? (storage as LocalDisk) : null;
