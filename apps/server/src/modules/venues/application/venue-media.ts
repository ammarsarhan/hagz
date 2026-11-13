import {
  MAXIMUM_VENUE_PHOTOS,
  type PhotoUpload,
  type ReorderPhotos,
  type RequestPhotoUpload,
  type VenuePhoto,
} from "@hagz/contracts";
import { randomUUID } from "node:crypto";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { storage } from "@/platform/storage/storage";
import { VENUE_PHOTO_ADDED, VENUE_PHOTO_REMOVED, VENUE_PHOTOS_REORDERED } from "../domain/events";
import type { VenueAccess } from "./access";
import { lockForEdit } from "./venue-edit";

// A venue's photos (PR 2.3). The app asks for an upload, sends the file straight to storage, then
// confirms; only then is the photo READY and on the venue page. Photos are part of the listing, so
// they're locked while the venue is reviewed and provisioned.

const UPLOAD_SECONDS = 15 * 60;
// Unconfirmed uploads are removed after this long (the sweeper job).
export const PENDING_PHOTO_HOURS = 24;

const EXTENSIONS: Record<RequestPhotoUpload["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const photoLimitReached = () =>
  new AppError({
    code: "PHOTO_LIMIT_REACHED",
    status: 409,
    detail: `A venue can have up to ${MAXIMUM_VENUE_PHOTOS} photos.`,
  });

export const photoNotFound = () =>
  new AppError({ code: "PHOTO_NOT_FOUND", status: 404, detail: "There's no such photo." });

const uploadMissing = () =>
  new AppError({
    code: "UPLOAD_NOT_FOUND",
    status: 409,
    detail: "The file hasn't arrived yet. Upload it, then confirm.",
  });

const uploadMismatch = () =>
  new AppError({
    code: "UPLOAD_MISMATCH",
    status: 422,
    detail: "The file isn't the type or size that was declared. Ask for a new upload.",
  });

const invalidPhotoOrder = () =>
  new AppError({
    code: "INVALID_PHOTO_ORDER",
    status: 422,
    detail: "List every ready photo exactly once.",
  });

const present = (media: {
  id: string;
  key: string;
  status: VenuePhoto["status"];
  position: number;
}) => ({
  id: media.id,
  url: storage.publicUrl(media.key),
  status: media.status,
  position: media.position,
});

export const listPhotos = async (venueId: string): Promise<VenuePhoto[]> => {
  const media = await prisma.venueMedia.findMany({
    where: { venueId, type: "IMAGE" },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true, key: true, status: true, position: true },
  });
  return media.map(present);
};

export const requestPhotoUpload = async (
  actor: VenueAccess,
  input: RequestPhotoUpload,
): Promise<PhotoUpload> => {
  const media = await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "listing");
    const count = await tx.venueMedia.count({ where: { venueId: actor.venueId, type: "IMAGE" } });
    if (count >= MAXIMUM_VENUE_PHOTOS) throw photoLimitReached();
    const last = await tx.venueMedia.findFirst({
      where: { venueId: actor.venueId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return tx.venueMedia.create({
      data: {
        venueId: actor.venueId,
        // A random name of its own: the key is public in the photo's URL, the id needn't be.
        key: `venues/${actor.venueId}/${randomUUID()}.${EXTENSIONS[input.contentType]}`,
        type: "IMAGE",
        contentType: input.contentType,
        size: input.size,
        position: last ? last.position + 1 : 0,
      },
      select: { id: true, key: true, status: true, position: true },
    });
  });
  const upload = await storage.uploadTarget(media.key, input, UPLOAD_SECONDS);
  return {
    photo: present(media),
    upload: { ...upload, expiresAt: upload.expiresAt.toISOString() },
  };
};

// Checks the file that arrived is the one declared, its type and its size, so an upload can't be
// swapped for something else.
export const confirmPhoto = async (actor: VenueAccess, photoId: string): Promise<VenuePhoto> => {
  const media = await prisma.venueMedia.findFirst({
    where: { id: photoId, venueId: actor.venueId, type: "IMAGE" },
    select: { id: true, key: true, status: true, position: true, contentType: true, size: true },
  });
  if (!media) throw photoNotFound();
  if (media.status === "READY") return present(media);

  const stored = await storage.head(media.key);
  if (!stored) throw uploadMissing();
  // The bucket refuses a different type or size against the signed headers; the local disk store
  // in development has no signature, so this check is what holds there.
  const otherType = stored.contentType !== null && stored.contentType !== media.contentType;
  if (otherType || stored.size !== media.size) {
    await storage.remove(media.key);
    throw uploadMismatch();
  }

  const ready = await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "listing");
    const confirmed = await tx.venueMedia.updateMany({
      where: { id: media.id, status: "PENDING" },
      data: { status: "READY" },
    });
    if (confirmed.count === 1) {
      await tx.venueEvent.create({
        data: {
          venueId: actor.venueId,
          staffId: actor.staffId,
          type: VENUE_PHOTO_ADDED,
          data: { photoId: media.id, size: stored.size },
        },
      });
    }
    return tx.venueMedia.findUniqueOrThrow({
      where: { id: media.id },
      select: { id: true, key: true, status: true, position: true },
    });
  });
  return present(ready);
};

export const reorderPhotos = async (actor: VenueAccess, input: ReorderPhotos) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "listing");
    const ready = await tx.venueMedia.findMany({
      where: { venueId: actor.venueId, type: "IMAGE", status: "READY" },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const current = ready.map((photo) => photo.id);
    const wanted = input.photoIds;
    if (
      wanted.length !== current.length ||
      new Set(wanted).size !== wanted.length ||
      !wanted.every((id) => current.includes(id))
    ) {
      throw invalidPhotoOrder();
    }
    if (wanted.every((id, i) => id === current[i])) return;
    for (const [position, id] of wanted.entries()) {
      await tx.venueMedia.update({ where: { id }, data: { position } });
    }
    await tx.venueEvent.create({
      data: {
        venueId: actor.venueId,
        staffId: actor.staffId,
        type: VENUE_PHOTOS_REORDERED,
        data: { previous: current, next: wanted },
      },
    });
  });
  return listPhotos(actor.venueId);
};

export const removePhoto = async (actor: VenueAccess, photoId: string) => {
  const key = await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "listing");
    const media = await tx.venueMedia.findFirst({
      where: { id: photoId, venueId: actor.venueId, type: "IMAGE" },
      select: { id: true, key: true, status: true },
    });
    if (!media) throw photoNotFound();
    await tx.venueMedia.delete({ where: { id: media.id } });
    if (media.status === "READY") {
      await tx.venueEvent.create({
        data: {
          venueId: actor.venueId,
          staffId: actor.staffId,
          type: VENUE_PHOTO_REMOVED,
          data: { photoId: media.id },
        },
      });
    }
    return media.key;
  });
  // After commit: a failed delete leaves an orphaned file, never a photo pointing at nothing.
  await storage.remove(key).catch((error: unknown) => {
    logger.warn({ err: error, key }, "couldn't remove a deleted photo's file");
  });
};

// The sweeper: uploads asked for but never confirmed (the app was closed, the upload failed).
export const sweepPendingPhotos = async (clock: Clock = systemClock) => {
  const before = new Date(clock.now().getTime() - PENDING_PHOTO_HOURS * 3600 * 1000);
  const stale = await prisma.venueMedia.findMany({
    where: { status: "PENDING", createdAt: { lt: before } },
    select: { id: true, key: true },
    take: 500,
  });
  for (const media of stale) {
    await storage.remove(media.key).catch((error: unknown) => {
      logger.warn({ err: error, key: media.key }, "couldn't remove an abandoned upload");
    });
    await prisma.venueMedia.deleteMany({ where: { id: media.id, status: "PENDING" } });
  }
  return stale.length;
};
