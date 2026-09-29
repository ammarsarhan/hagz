import { z } from "zod";

export const createBookingSchema = z
  .object({
    pitchId: z.string().min(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((b) => b.endsAt > b.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
