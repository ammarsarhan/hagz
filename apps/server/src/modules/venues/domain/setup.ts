import type { SetupItem, SetupItemKey, VenueSetup } from "@hagz/contracts";

// The setup checklist (docs/onboarding.md, step 2), computed from the venue's data on every request
// and never stored, so it can't disagree with the venue. Items join as their features ship: photos
// (2.3), grounds and schedules (2.4) and layout (2.5) add their own facts and rules here.

export interface SetupFacts {
  status: VenueSetup["venue"]["status"];
  phone: string | null;
  translations: { name: string; description: string | null; address: string | null }[];
  hasPin: boolean;
  cancellationPolicy: string | null;
  amenityCount: number;
  taxNumber: string | null;
}

const filled = (text: string | null) => text !== null && text.trim().length > 0;

// Name, description and address in at least one language, and a phone. Admins add the other
// language while provisioning.
const detailsDone = (facts: SetupFacts) =>
  filled(facts.phone) &&
  facts.translations.some((t) => filled(t.name) && filled(t.description) && filled(t.address));

// Payment mode and notice have working defaults; the cancellation policy has to be chosen on
// purpose (user, 2026-11-12), so it alone decides the item.
const settingsDone = (facts: SetupFacts) => facts.cancellationPolicy !== null;

const RULES: { key: SetupItemKey; required: boolean; done: (facts: SetupFacts) => boolean }[] = [
  { key: "DETAILS", required: true, done: detailsDone },
  { key: "LOCATION", required: true, done: (facts) => facts.hasPin },
  { key: "SETTINGS", required: true, done: settingsDone },
  { key: "AMENITIES", required: false, done: (facts) => facts.amenityCount > 0 },
  { key: "TAX_NUMBER", required: false, done: (facts) => filled(facts.taxNumber) },
];

export const setupChecklist = (facts: SetupFacts): Omit<VenueSetup, "venue"> => {
  const items: SetupItem[] = RULES.map(({ key, required, done }) => ({
    key,
    required,
    state: done(facts) ? "DONE" : "MISSING",
    blockedBy: null,
  }));
  const required = items.filter((item) => item.required);
  const done = required.filter((item) => item.state === "DONE").length;
  return {
    items,
    required: { done, total: required.length },
    canSubmit: facts.status === "DRAFT" && done === required.length,
  };
};
