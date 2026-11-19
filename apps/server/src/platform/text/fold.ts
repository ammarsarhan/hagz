import { Prisma } from "@/generated/prisma/client";

// A name folded for search, so every spelling of it compares equal: case, Latin accents, Arabic
// diacritics and tatweel, the interchangeable Arabic letters (أ إ آ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي),
// Arabic-Indic digits, and spaces, apostrophes, dots and hyphens (including the invisible marks pasted
// text carries). "smouha", "Smouha" and "سموحه" all fold like سموحة.
//
// The database has the same function, fold_name(), which names are indexed on (pg_trgm). This one
// folds what the player typed; a test keeps the two equal, so a change here needs a migration that
// replaces fold_name() and rebuilds the indexes on it.

// Dropped after NFKD, which splits accented letters and the hamza and madda forms into a base letter
// plus marks. The same code points, in the same order, as the character class in fold_name().
const DROPPED: readonly (readonly [number, number])[] = [
  [0x0300, 0x036f], // Latin combining accents.
  [0x0640, 0x0640], // Tatweel.
  [0x064b, 0x0655], // Arabic diacritics, hamza and madda marks.
  [0x0670, 0x0670], // Superscript alef.
  [0x0009, 0x000d], // Tab and line breaks.
  [0x0020, 0x0020], // Space.
  [0x00a0, 0x00a0], // No-break space.
  [0x2000, 0x200f], // Typographic and zero-width spaces, joiners, bidi marks.
  [0x202f, 0x202f], // Narrow no-break space.
  [0x2019, 0x2019], // Curly apostrophe.
  [0x205f, 0x205f], // Math space.
  [0x3000, 0x3000], // Ideographic space.
  [0xfeff, 0xfeff], // Byte order mark.
  [0x0027, 0x0027], // Apostrophe.
  [0x002e, 0x002e], // Dot.
  [0x002d, 0x002d], // Hyphen.
];

const isDropped = (code: number) => DROPPED.some(([from, to]) => code >= from && code <= to);

// ى → ي, ة → ه, and both sets of Arabic-Indic digits (U+0660 and U+06F0 onwards) → 0–9.
const LETTERS = new Map<string, string>([
  ["ى", "ي"],
  ["ة", "ه"],
]);
for (let digit = 0; digit < 10; digit++) {
  LETTERS.set(String.fromCodePoint(0x0660 + digit), String(digit));
  LETTERS.set(String.fromCodePoint(0x06f0 + digit), String(digit));
}

export const foldName = (name: string): string => {
  let folded = "";
  for (const char of name.toLowerCase().normalize("NFKD")) {
    const code = char.codePointAt(0);
    if (code !== undefined && !isDropped(code)) folded += LETTERS.get(char) ?? char;
  }
  return folded;
};

// The database's fold of a column, for WHERE clauses that should use the trigram index.
export const foldNameSql = (column: Prisma.Sql) => Prisma.sql`fold_name(${column})`;

// Text matched with LIKE as typed: % and _ are wildcards to LIKE.
export const likeLiteral = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);
