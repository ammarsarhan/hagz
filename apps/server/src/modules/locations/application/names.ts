import type { Names } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import type { Tx } from "@/platform/db/transaction";

// Reference data keeps one translation row per language; admins read and write both at once.

export const translationRows = (names: Names) => [
  { language: "EN" as const, name: names.en },
  { language: "AR" as const, name: names.ar },
];

// Rows back into a pair. A missing language (data from before both were required) reads as the other.
export const namesOf = (rows: { language: Language; name: string }[]): Names => {
  const en = rows.find((row) => row.language === "EN")?.name;
  const ar = rows.find((row) => row.language === "AR")?.name;
  return { en: en ?? ar ?? "", ar: ar ?? en ?? "" };
};

// The name in one language, falling back to the other. For public responses.
export const nameIn = (rows: { language: Language; name: string }[], language: Language) =>
  (rows.find((row) => row.language === language) ?? rows[0])?.name ?? "";

// Replaces a row's translations with `names`, through whichever translation table it has.
export const upsertNames = async (
  upsert: (row: { language: Language; name: string }) => Promise<unknown>,
  names: Names,
) => {
  for (const row of translationRows(names)) await upsert(row);
};

// Locks a marketplace row for the rest of the transaction and says whether it exists. `share` lets
// other readers in but makes a concurrent edit of its code or currency wait (see marketplaces.ts).
export const lockMarketplace = async (tx: Tx, id: string, mode: "share" | "update") => {
  const rows =
    mode === "share"
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Marketplace" WHERE id = ${id}::uuid FOR SHARE`
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Marketplace" WHERE id = ${id}::uuid FOR UPDATE`;
  return rows.length > 0;
};
