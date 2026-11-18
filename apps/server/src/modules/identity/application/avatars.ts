import {
  MAXIMUM_AVATAR_BYTES,
  PHOTO_TYPES,
  type AvatarUpload,
  type CustomerProfile,
  type RequestAvatarUpload,
} from "@hagz/contracts";
import { randomUUID } from "node:crypto";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { storage } from "@/platform/storage/storage";
import { profile } from "./accounts";
import { sessionEnded } from "./sessions";

// A customer's profile photo (PR 2.3), as venue photos work: the app asks for an upload, sends the
// file straight to storage, then confirms it. The customer row keeps the one upload in progress
// (asking again replaces it), so the sweeper can remove a file that was never confirmed; confirming
// makes it the photo and removes the one before. Files go after the commit, so a failed delete
// leaves an orphaned file, never a profile pointing at nothing.

const UPLOAD_SECONDS = 15 * 60;
// Unconfirmed uploads are removed after this long (the sweeper).
export const PENDING_AVATAR_HOURS = 24;

const EXTENSIONS: Record<RequestAvatarUpload["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const uploadMissing = () =>
  new AppError({
    code: "UPLOAD_NOT_FOUND",
    status: 409,
    detail: "There's no upload to confirm. Ask for one, upload the file, then confirm.",
  });

const uploadMismatch = () =>
  new AppError({
    code: "UPLOAD_MISMATCH",
    status: 422,
    detail: "The file isn't an image of an allowed type and size. Ask for a new upload.",
  });

const removeFile = (key: string, why: string) =>
  storage.remove(key).catch((error: unknown) => {
    logger.warn({ err: error, key }, why);
  });

const findCustomer = async (customerId: string) => {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  // Deleting an account ends its sessions, but an access token works until it expires.
  if (!customer || customer.deletedAt) throw sessionEnded();
  return customer;
};

export const customerProfile = async (customerId: string): Promise<CustomerProfile> => {
  const customer = await findCustomer(customerId);
  return {
    ...profile(customer),
    avatarUrl: customer.avatarKey ? storage.publicUrl(customer.avatarKey) : null,
  };
};

export const requestAvatarUpload = async (
  customerId: string,
  input: RequestAvatarUpload,
  clock: Clock = systemClock,
): Promise<AvatarUpload> => {
  const previous = (await findCustomer(customerId)).avatarUploadKey;
  // A random name of its own: the key is public in the photo's URL.
  const key = `customers/${customerId}/${randomUUID()}.${EXTENSIONS[input.contentType]}`;
  await prisma.customer.update({
    where: { id: customerId },
    data: { avatarUploadKey: key, avatarUploadAt: clock.now() },
  });
  if (previous) await removeFile(previous, "couldn't remove a replaced avatar upload");
  const upload = await storage.uploadTarget(key, input, UPLOAD_SECONDS);
  return { ...upload, expiresAt: upload.expiresAt.toISOString() };
};

// Checks the file that arrived is an image of an allowed type and size (the bucket also holds it to
// the signed request; the local disk store in development has no signature, so this is what holds
// there), then makes it the photo.
export const confirmAvatar = async (customerId: string): Promise<CustomerProfile> => {
  const customer = await findCustomer(customerId);
  const key = customer.avatarUploadKey;
  if (!key) throw uploadMissing();

  const stored = await storage.head(key);
  if (!stored) throw uploadMissing();
  const allowedType =
    stored.contentType === null || (PHOTO_TYPES as readonly string[]).includes(stored.contentType);
  if (!allowedType || stored.size < 1 || stored.size > MAXIMUM_AVATAR_BYTES) {
    await prisma.customer.updateMany({
      where: { id: customerId, avatarUploadKey: key },
      data: { avatarUploadKey: null, avatarUploadAt: null },
    });
    await removeFile(key, "couldn't remove a refused avatar upload");
    throw uploadMismatch();
  }

  // Only if it's still the upload in progress: a newer request replaced it otherwise.
  const confirmed = await prisma.customer.updateMany({
    where: { id: customerId, avatarUploadKey: key },
    data: { avatarKey: key, avatarUploadKey: null, avatarUploadAt: null },
  });
  if (confirmed.count === 0) throw uploadMissing();
  if (customer.avatarKey && customer.avatarKey !== key) {
    await removeFile(customer.avatarKey, "couldn't remove a replaced avatar");
  }
  return customerProfile(customerId);
};

export const removeAvatar = async (customerId: string) => {
  const customer = await findCustomer(customerId);
  if (!customer.avatarKey) return;
  await prisma.customer.updateMany({
    where: { id: customerId, avatarKey: customer.avatarKey },
    data: { avatarKey: null },
  });
  await removeFile(customer.avatarKey, "couldn't remove a deleted avatar");
};

// The sweeper: uploads asked for but never confirmed (the app was closed, the upload failed).
export const sweepAvatarUploads = async (clock: Clock = systemClock) => {
  const before = new Date(clock.now().getTime() - PENDING_AVATAR_HOURS * 3600 * 1000);
  const stale = await prisma.customer.findMany({
    where: { avatarUploadAt: { lt: before } },
    select: { id: true, avatarUploadKey: true },
    take: 500,
  });
  for (const { id, avatarUploadKey: key } of stale) {
    if (!key) continue;
    await removeFile(key, "couldn't remove an abandoned avatar upload");
    await prisma.customer.updateMany({
      where: { id, avatarUploadKey: key },
      data: { avatarUploadKey: null, avatarUploadAt: null },
    });
  }
  return stale.length;
};
