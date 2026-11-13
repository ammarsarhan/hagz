import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@/platform/errors/app-error";
import type { StorageProvider, StoredObject, UploadTarget } from "./storage-provider";

const expiry = (seconds: number) => new Date(Date.now() + seconds * 1000);

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

// Any S3-compatible store; Cloudflare R2 in production (region "auto").
export const createS3Provider = (config: S3Config): StorageProvider => {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return {
    name: "s3",
    uploadTarget: async (key, { contentType, size }, expiresInSeconds) => {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
        signableHeaders: new Set(["content-type", "content-length"]),
      });
      return {
        url,
        method: "PUT",
        headers: { "Content-Type": contentType, "Content-Length": String(size) },
        expiresAt: expiry(expiresInSeconds),
      };
    },
    head: async (key) => {
      try {
        const object = await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        return { size: object.ContentLength ?? 0, contentType: object.ContentType ?? null };
      } catch (error) {
        if (error instanceof NotFound) return null;
        if (
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        ) {
          return null;
        }
        throw error;
      }
    },
    remove: async (key) => {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    publicUrl: (key) => `${config.publicUrl}/${key}`,
  };
};

// Tests: files live in a map. `put` stands in for the app's upload.
export const createInMemoryStorage = () => {
  const objects = new Map<string, StoredObject & { bytes: Uint8Array }>();
  const provider = {
    name: "memory",
    objects,
    put: (key: string, bytes: Uint8Array, contentType: string) => {
      objects.set(key, { bytes, size: bytes.byteLength, contentType });
    },
    uploadTarget: (key: string, file: { contentType: string; size: number }, seconds: number) =>
      Promise.resolve<UploadTarget>({
        url: `memory://${key}`,
        method: "PUT",
        headers: { "Content-Type": file.contentType, "Content-Length": String(file.size) },
        expiresAt: expiry(seconds),
      }),
    head: (key: string) => {
      const object = objects.get(key);
      return Promise.resolve(
        object ? { size: object.size, contentType: object.contentType } : null,
      );
    },
    remove: (key: string) => {
      objects.delete(key);
      return Promise.resolve();
    },
    publicUrl: (key: string) => `memory://${key}`,
  };
  return provider satisfies StorageProvider;
};

// Development: files on disk under `root`, uploaded and read through the API's dev-only storage
// route (http/dev-storage.ts), so photos work with no bucket. Each file has a sidecar with its type.
export const createLocalDiskStorage = (root: string, baseUrl: string) => {
  const file = (key: string) => {
    const resolved = path.resolve(root, key);
    if (!resolved.startsWith(path.resolve(root) + path.sep))
      throw new Error("Key escapes the root");
    return resolved;
  };
  const provider = {
    name: "local-disk",
    write: async (key: string, bytes: Uint8Array, contentType: string) => {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), bytes);
      await writeFile(`${file(key)}.type`, contentType);
    },
    read: async (key: string) => {
      try {
        const [bytes, contentType] = await Promise.all([
          readFile(file(key)),
          readFile(`${file(key)}.type`, "utf8"),
        ]);
        return { bytes, contentType };
      } catch {
        return null;
      }
    },
    uploadTarget: (key: string, upload: { contentType: string; size: number }, seconds: number) =>
      Promise.resolve<UploadTarget>({
        url: `${baseUrl}/v1/dev/storage/${key}`,
        method: "PUT",
        headers: { "Content-Type": upload.contentType, "Content-Length": String(upload.size) },
        expiresAt: expiry(seconds),
      }),
    head: async (key: string) => {
      try {
        const [info, contentType] = await Promise.all([
          stat(file(key)),
          readFile(`${file(key)}.type`, "utf8"),
        ]);
        return { size: info.size, contentType };
      } catch {
        return null;
      }
    },
    remove: async (key: string) => {
      await rm(file(key), { force: true });
      await rm(`${file(key)}.type`, { force: true });
    },
    publicUrl: (key: string) => `${baseUrl}/v1/dev/storage/${key}`,
  };
  return provider satisfies StorageProvider;
};

export const storageUnavailable = () =>
  new AppError({
    code: "STORAGE_UNAVAILABLE",
    status: 503,
    detail: "Uploads aren't set up in this environment yet.",
  });

// Staging or production without a bucket: refuse uploads instead of losing files.
export const unconfiguredStorage: StorageProvider = {
  name: "unconfigured",
  uploadTarget: () => Promise.reject(storageUnavailable()),
  head: () => Promise.reject(storageUnavailable()),
  remove: () => Promise.reject(storageUnavailable()),
  publicUrl: (key) => key,
};
