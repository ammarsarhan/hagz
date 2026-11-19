import { describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { foldName } from "@/platform/text/fold";

// Spellings players and owners actually type or paste, and the invisible characters that come with
// pasted text.
const CORPUS = [
  "Smouha",
  "SMOUHA",
  "سموحة",
  "سموحه",
  "سَمُوحَة",
  "الإسكندرية",
  "الاسكندريه",
  "آل",
  "مؤسسة",
  "شاطئ",
  "مصطفى",
  "مصطفي",
  "كــورة",
  "Café Olé",
  "Sporting-Club",
  "Al Ahly",
  "Al-Ahly's pitch",
  "Mr. Pitch",
  "Ramadan’s cup",
  "ملعب ٥",
  "ملعب ۵",
  "ﻣﻠﻌﺐ",
  "Zamalek \u00A0Club",
  "نادي \u200Fالزمالك",
  "\uFEFFNasr City",
  "Tab \u0009 and \u000A line",
];

const sqlFold = async (name: string) => {
  const [row] = await prisma.$queryRaw<{ folded: string }[]>`SELECT fold_name(${name}) AS folded`;
  return row?.folded;
};

describe("folding names", () => {
  it("folds the same way in the app and in the database", async () => {
    for (const name of CORPUS) {
      expect({ name, folded: foldName(name) }).toEqual({ name, folded: await sqlFold(name) });
    }
  });

  it("makes every spelling of a name equal", () => {
    const same = (...names: string[]) => {
      expect(new Set(names.map(foldName)).size, names.join(" / ")).toBe(1);
    };
    same("Smouha", "SMOUHA", "smouha");
    same("سموحة", "سموحه", "سَمُوحَة");
    same("الإسكندرية", "الاسكندريه", "الأسكندرية");
    same("مصطفى", "مصطفي");
    same("كورة", "كــورة");
    same("Café", "cafe");
    same("Al Ahly", "Al-Ahly", "alahly");
    same("ملعب 5", "ملعب ٥", "ملعب ۵");
    same("ملعب", "ﻣﻠﻌﺐ");
    same("Zamalek Club", "Zamalek \u00A0Club", "\uFEFFZamalek Club");
  });

  it("keeps different names apart", () => {
    expect(foldName("Smouha")).not.toBe(foldName("Stanley"));
    expect(foldName("ملعب ٥")).not.toBe(foldName("ملعب ٧"));
  });
});
