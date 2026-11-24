import { env } from "@/platform/config/env";
import { AppError } from "@/platform/errors/app-error";
import type { PaymentProvider } from "./payment-provider";

// The stand-in provider until Phase 5 (user, 2026-11-22): it takes no money and pays nothing out.
// A checkout is settled by hand through the development routes (/v1/dev/payments/...), so HELD
// bookings go through the real flow, paid or failed, in the apps and in tests.
export const fakePayments: PaymentProvider = {
  name: "fake",
  configured: true,
  createCheckout: ({ paymentId }) => Promise.resolve({ reference: `fake_${paymentId}`, url: null }),
};

export const paymentsUnavailable = () =>
  new AppError({
    code: "PAYMENTS_UNAVAILABLE",
    status: 503,
    detail: "Online payment isn't available yet.",
  });

// Production has no provider until Phase 5, so online checkout is refused there rather than faked.
const unconfiguredPayments: PaymentProvider = {
  name: "unconfigured",
  configured: false,
  createCheckout: () => Promise.reject(paymentsUnavailable()),
};

export const selectPayments = (config: Pick<typeof env, "APP_ENV">): PaymentProvider =>
  config.APP_ENV === "production" ? unconfiguredPayments : fakePayments;

// The provider for this process, chosen once from the environment.
export const payments = selectPayments(env);
