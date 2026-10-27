import { z } from "zod";

// For requests that create something (bookings, payments, refunds, payouts). The client generates one
// UUID per user action and sends it on every retry of that action. A retry gets the original
// response (same status) with Idempotent-Replayed: true; the same key with a different request gets
// 422 IDEMPOTENCY_KEY_REUSED.
export const IdempotencyHeaders = z.object({
  "idempotency-key": z.uuid().meta({
    description: "One UUID per user action, reused on every retry of it.",
    example: "0192f0c4-8a7e-7b3e-9a51-2f6c1d0e4b7a",
  }),
});

export type IdempotencyHeaders = z.infer<typeof IdempotencyHeaders>;
