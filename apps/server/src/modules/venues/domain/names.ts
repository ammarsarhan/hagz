// A translated name in the wanted language, else any language, else none.
export const nameIn = <Language extends string>(
  translations: { language: Language; name: string }[],
  language: Language,
): string | null =>
  (translations.find((t) => t.language === language) ?? translations[0])?.name ?? null;
