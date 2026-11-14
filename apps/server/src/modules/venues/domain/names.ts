// A translation in the wanted language, else any language, else none.
export const translationIn = <Language extends string, T extends { language: Language }>(
  translations: T[],
  language: Language,
): T | undefined => translations.find((t) => t.language === language) ?? translations[0];

export const nameIn = <Language extends string>(
  translations: { language: Language; name: string }[],
  language: Language,
): string | null => translationIn(translations, language)?.name ?? null;

// "Zamalek, Cairo": the venue's own place, then the one it sits in (if any), which is how people
// say where a pitch is; the street address is longer and less telling. A venue waiting for its
// requested area has none.
export const placeOf = <Language extends string>(
  location: {
    translations: { language: Language; name: string }[];
    parent: { translations: { language: Language; name: string }[] } | null;
  } | null,
  language: Language,
): string | null => {
  if (!location) return null;
  const names = [location, location.parent]
    .map((place) => (place ? nameIn(place.translations, language) : null))
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(language === "AR" ? "، " : ", ") : null;
};

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
