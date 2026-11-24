import { z } from "zod";

// Paying for a booking online (Phase 4 stub, Phase 5 for real). Money that moved, never prices: a
// booking's price is its charges. Until Phase 5 the provider is a stand-in that takes no money; a
// checkout is settled by hand through the development routes.

export const PaymentStatus = z.enum(["PENDING", "SUCCEEDED", "FAILED", "EXPIRED"]).meta({
  id: "PaymentStatus",
  description: "`PENDING`: waiting on the provider. `EXPIRED`: replaced by a newer checkout.",
});

export const OnlinePaymentMethod = z.enum(["CARD", "WALLET"]).meta({ id: "OnlinePaymentMethod" });

export const StartCheckout = z
  .object({ method: OnlinePaymentMethod.default("CARD") })
  .meta({ id: "StartCheckout" });

export const Checkout = z
  .object({
    payment: z.object({
      id: z.uuid(),
      status: PaymentStatus,
      method: OnlinePaymentMethod,
      amount: z.int().meta({ description: "Minor units: the deposit, or the whole total." }),
      currency: z.string().meta({ example: "EGP" }),
    }),
    provider: z.string().meta({ description: "`fake` until Phase 5.", example: "fake" }),
    reference: z.string().meta({ description: "The provider's id for this payment." }),
    url: z.string().nullable().meta({
      description: "The provider's page to pay on; null for the stand-in provider.",
    }),
  })
  .meta({ id: "Checkout" });

export type PaymentStatus = z.infer<typeof PaymentStatus>;
export type StartCheckout = z.infer<typeof StartCheckout>;
export type Checkout = z.infer<typeof Checkout>;
