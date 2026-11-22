// The one place payment providers plug in (docs/architecture.md, "Payments and money"). Provider
// neutral: Payment stores the provider's name and its reference as plain fields, so switching or
// adding one needs no migration. Phase 5 adds the real adapter (Paymob) and the rest of the
// interface: verifying webhooks, fetching a payment's status for reconciliation, and refunds.

export interface CheckoutRequest {
  // Payment.id: the provider's merchant reference, so a retried call can't charge twice.
  paymentId: string;
  amount: number; // Minor units.
  currency: string;
  method: "CARD" | "WALLET";
  // Shown on the provider's page and receipts.
  description: string;
}

export interface CheckoutSession {
  // The provider's id for this payment (Payment.providerReference).
  reference: string;
  // Where the app sends the player to pay, if the provider has a hosted page.
  url: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  // False until a real provider is set up; checkout is refused before anything is written.
  readonly configured: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}
