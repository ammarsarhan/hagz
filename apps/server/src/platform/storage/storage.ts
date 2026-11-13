import path from "node:path";
import { env } from "@/platform/config/env";
import {
  createInMemoryStorage,
  createLocalDiskStorage,
  createS3Provider,
  unconfiguredStorage,
} from "./providers";
import type { StorageProvider } from "./storage-provider";

type StorageEnv = Pick<
  typeof env,
  | "NODE_ENV"
  | "APP_ENV"
  | "PORT"
  | "STORAGE_ENDPOINT"
  | "STORAGE_BUCKET"
  | "STORAGE_ACCESS_KEY_ID"
  | "STORAGE_SECRET_ACCESS_KEY"
  | "STORAGE_PUBLIC_URL"
>;

// Local files live in apps/server/.storage (the process runs from apps/server), ignored by git.
export const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), ".storage");

export const selectStorage = (config: StorageEnv): StorageProvider => {
  if (config.NODE_ENV === "test") return createInMemoryStorage();
  const {
    STORAGE_ENDPOINT: endpoint,
    STORAGE_BUCKET: bucket,
    STORAGE_ACCESS_KEY_ID: accessKeyId,
    STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
    STORAGE_PUBLIC_URL: publicUrl,
  } = config;
  if (endpoint && bucket && accessKeyId && secretAccessKey && publicUrl) {
    return createS3Provider({ endpoint, bucket, accessKeyId, secretAccessKey, publicUrl });
  }
  if (config.APP_ENV === "development") {
    return createLocalDiskStorage(LOCAL_STORAGE_ROOT, `http://localhost:${config.PORT}`);
  }
  return unconfiguredStorage;
};

// The store for this process, chosen once from the environment.
export const storage = selectStorage(env);
