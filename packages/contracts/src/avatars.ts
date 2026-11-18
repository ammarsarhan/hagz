import { z } from "zod";
import { Customer } from "./auth";
import { PHOTO_TYPES } from "./venue-media";

// A customer's profile photo (PR 2.3). Like a venue photo, the app asks for an upload, sends the
// file straight to storage, then confirms it; only then does it replace the current one.

export const MAXIMUM_AVATAR_BYTES = 5 * 1024 * 1024;

export const RequestAvatarUpload = z
  .object({
    contentType: z.enum(PHOTO_TYPES),
    size: z.int().min(1).max(MAXIMUM_AVATAR_BYTES).meta({ description: "In bytes." }),
  })
  .meta({ id: "RequestAvatarUpload" });

export const AvatarUpload = z
  .object({
    url: z.string(),
    method: z.literal("PUT"),
    headers: z.record(z.string(), z.string()).meta({ description: "Send exactly these." }),
    expiresAt: z.iso.datetime(),
  })
  .meta({
    id: "AvatarUpload",
    description:
      "Upload the file here, then confirm it. Unconfirmed uploads are removed after a day.",
  });

// The signed-in customer, with their photo.
export const CustomerProfile = Customer.extend({
  avatarUrl: z.string().nullable().meta({ description: "Null until they add a photo." }),
}).meta({ id: "CustomerProfile" });

export type RequestAvatarUpload = z.infer<typeof RequestAvatarUpload>;
export type AvatarUpload = z.infer<typeof AvatarUpload>;
export type CustomerProfile = z.infer<typeof CustomerProfile>;
