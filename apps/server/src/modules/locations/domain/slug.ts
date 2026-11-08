// A location's URL slug from its English name: "Nasr City" → "nasr-city", "Al-Nahda (East)" →
// "al-nahda-east". Accents are dropped, anything else that isn't a letter or digit becomes one hyphen.
// The name is validated to contain a letter or digit, so the slug is never empty.
export const slugify = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
