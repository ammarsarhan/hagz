import {
  MINIMUM_VENUE_PHOTOS,
  type SetupItem,
  type SetupItemKey,
  type VenueSetup,
} from "@hagz/contracts";

// The setup checklist (docs/onboarding.md, step 2), computed from the venue's data on every request
// and never stored, so it can't disagree with the venue.

export interface SetupFacts {
  status: VenueSetup["venue"]["status"];
  phone: string | null;
  translations: { name: string; description: string | null; address: string | null }[];
  hasPin: boolean;
  readyPhotos: number;
  // Open hours per active ground (paused grounds don't count).
  activeGrounds: { openHours: number; placed: boolean }[];
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

const hasGrounds = (facts: SetupFacts) => facts.activeGrounds.length > 0;

interface Rule {
  key: SetupItemKey;
  required: boolean;
  done: (facts: SetupFacts) => boolean;
  // Can't be done before this item is.
  after?: { key: SetupItemKey; done: (facts: SetupFacts) => boolean };
  // Left off the checklist when it doesn't apply.
  applies?: (facts: SetupFacts) => boolean;
}

const RULES: Rule[] = [
  { key: "DETAILS", required: true, done: detailsDone },
  { key: "LOCATION", required: true, done: (facts) => facts.hasPin },
  { key: "PHOTOS", required: true, done: (facts) => facts.readyPhotos >= MINIMUM_VENUE_PHOTOS },
  { key: "GROUNDS", required: true, done: hasGrounds },
  {
    key: "SCHEDULES",
    required: true,
    // Every active ground open at least an hour a week.
    done: (facts) => hasGrounds(facts) && facts.activeGrounds.every((g) => g.openHours > 0),
    after: { key: "GROUNDS", done: hasGrounds },
  },
  {
    // Only venues with more than one ground need a layout (decided 2026-10-24).
    key: "LAYOUT",
    required: true,
    done: (facts) => facts.activeGrounds.every((g) => g.placed),
    applies: (facts) => facts.activeGrounds.length > 1,
  },
  { key: "SETTINGS", required: true, done: settingsDone },
  { key: "AMENITIES", required: false, done: (facts) => facts.amenityCount > 0 },
  { key: "TAX_NUMBER", required: false, done: (facts) => filled(facts.taxNumber) },
];

export const setupChecklist = (facts: SetupFacts): Omit<VenueSetup, "venue"> => {
  const items: SetupItem[] = RULES.filter((rule) => rule.applies?.(facts) ?? true).map(
    ({ key, required, done, after }) => {
      if (after && !after.done(facts))
        return { key, required, state: "BLOCKED", blockedBy: after.key };
      return { key, required, state: done(facts) ? "DONE" : "MISSING", blockedBy: null };
    },
  );
  const required = items.filter((item) => item.required);
  const done = required.filter((item) => item.state === "DONE").length;
  return {
    items,
    required: { done, total: required.length },
    canSubmit: facts.status === "DRAFT" && done === required.length,
  };
};
