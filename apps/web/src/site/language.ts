// Which language a visitor reads the site in, before they've picked one. Kept tiny: the proxy
// (src/proxy.ts) imports it.

// Set by the footer's language switch: the visitor's own pick, which beats their browser's.
export const LANGUAGE_COOKIE = "hagz_lang";

// A year, so the pick survives between visits.
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Whether an Accept-Language header ranks Arabic above English ("ar-EG,ar;q=0.9,en;q=0.8" yes,
// "en-US,en;q=0.9,ar;q=0.5" no). Neither listed: English, the site's default (search engines' crawlers
// send none, so they read the English page).
export const prefersArabic = (header: string | null) => {
  if (!header) return false;
  let best: { language: string; q: number } | null = null;
  for (const part of header.split(",")) {
    const [tag = "", ...params] = part.trim().split(";");
    const language = tag.trim().toLowerCase().split("-")[0];
    if (language !== "ar" && language !== "en") continue;
    const qParam = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    // Ties go to the one listed first.
    if (Number.isFinite(q) && (!best || q > best.q)) best = { language, q };
  }
  return best?.language === "ar" && best.q > 0;
};
