import { randomInt } from "node:crypto";

// A venue's permanent public id (docs/onboarding.md, "Slugs and SEO"): /venue/k7m2x9pq. Lowercase
// letters and digits without the ones people misread (0/o, 1/l/i), so a slug read aloud or copied
// by hand still works. 31^8 ≈ 8.5 × 10^11, so a clash with the unique index is rare and retried.
export const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SLUG_LENGTH = 8;

export const generateSlug = (pick: (size: number) => number = randomInt): string =>
  Array.from({ length: SLUG_LENGTH }, () => SLUG_ALPHABET[pick(SLUG_ALPHABET.length)]).join("");
