// A translation in the wanted language, else any language, else none.
export const translationIn = <Language extends string, T extends { language: Language }>(
  translations: T[],
  language: Language,
): T | undefined => translations.find((t) => t.language === language) ?? translations[0];

export const nameIn = <Language extends string>(
  translations: { language: Language; name: string }[],
  language: Language,
): string | null => translationIn(translations, language)?.name ?? null;

// "Omar Saleh" → "OS", "Mona" → "M": the first letters of the first and last words. Array.from keeps
// letters outside the BMP whole.
export const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return "";
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .map((word) => (word ? (Array.from(word)[0] ?? "") : ""))
    .join("")
    .toUpperCase();
};
