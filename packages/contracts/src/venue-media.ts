import { z } from "zod";

// A venue's photos (PR 2.3): the app resizes them (about 2048 px, JPEG) and uploads straight to
// storage with a signed request; the API only hands out the request and checks what arrived.

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAXIMUM_PHOTO_BYTES = 10 * 1024 * 1024;
export const MINIMUM_VENUE_PHOTOS = 3;
export const MAXIMUM_VENUE_PHOTOS = 20;

export const RequestPhotoUpload = z
  .object({
    contentType: z.enum(PHOTO_TYPES),
    size: z.int().min(1).max(MAXIMUM_PHOTO_BYTES).meta({ description: "In bytes." }),
  })
  .meta({ id: "RequestPhotoUpload" });

export const PhotoStatus = z.enum(["PENDING", "READY"]).meta({
  id: "PhotoStatus",
  description: "`PENDING` until the upload is confirmed; unconfirmed ones are removed after a day.",
});

export const VenuePhoto = z
  .object({
    id: z.uuid(),
    url: z.string().meta({ description: "Where to load it from." }),
    status: PhotoStatus,
    position: z
      .int()
      .min(0)
      .meta({ description: "Order on the venue page; the first is the cover." }),
  })
  .meta({ id: "VenuePhoto" });

export const PhotoUpload = z
  .object({
    photo: VenuePhoto,
    upload: z
      .object({
        url: z.string(),
        method: z.literal("PUT"),
        headers: z.record(z.string(), z.string()).meta({ description: "Send exactly these." }),
        expiresAt: z.iso.datetime(),
      })
      .meta({ description: "Upload the file here, then confirm it." }),
  })
  .meta({ id: "PhotoUpload" });

export const ReorderPhotos = z
  .object({
    photoIds: z
      .array(z.uuid())
      .max(MAXIMUM_VENUE_PHOTOS)
      .meta({ description: "Every ready photo, in the new order; the first becomes the cover." }),
  })
  .meta({ id: "ReorderPhotos" });

export type RequestPhotoUpload = z.infer<typeof RequestPhotoUpload>;
export type PhotoStatus = z.infer<typeof PhotoStatus>;
export type VenuePhoto = z.infer<typeof VenuePhoto>;
export type PhotoUpload = z.infer<typeof PhotoUpload>;
export type ReorderPhotos = z.infer<typeof ReorderPhotos>;
