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
