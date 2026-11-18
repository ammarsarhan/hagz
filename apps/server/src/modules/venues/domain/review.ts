import type { SetupItemKey } from "@hagz/contracts";

// What going live needs (docs/onboarding.md, step 3): the listing in Arabic and English, and a
// ground players can book. Slot generation (PR 2.6) will add "every ground generated" here.

export type GoLiveGap = "AR_TRANSLATION" | "EN_TRANSLATION" | "ACTIVE_GROUND";

const complete = (t: { name: string; description: string | null; address: string | null }) =>
  [t.name, t.description, t.address].every((text) => text !== null && text.trim().length > 0);

export const goLiveGaps = (
  translations: {
    language: "AR" | "EN";
    name: string;
    description: string | null;
    address: string | null;
  }[],
  activeGrounds: number,
): GoLiveGap[] => {
  const gaps: GoLiveGap[] = [];
  for (const language of ["AR", "EN"] as const) {
    const translation = translations.find((t) => t.language === language);
    if (!translation || !complete(translation)) gaps.push(`${language}_TRANSLATION`);
  }
  if (activeGrounds === 0) gaps.push("ACTIVE_GROUND");
  return gaps;
};

// Sending a venue back with the sections to change (docs/onboarding.md, step 3): each flagged
// section's fingerprint is kept with the send-back (application/section-fingerprints.ts), and the
// section still needs changes while its fingerprint now is the same. Changing it and changing it
// back counts as unchanged; any real difference counts as changed, not necessarily fixed: the next
// review judges that. A section with no kept fingerprint doesn't hold the venue up.
export const unchangedSections = (
  asked: SetupItemKey[],
  before: Partial<Record<SetupItemKey, string>>,
  now: Partial<Record<SetupItemKey, string>>,
): SetupItemKey[] => asked.filter((key) => before[key] !== undefined && before[key] === now[key]);
