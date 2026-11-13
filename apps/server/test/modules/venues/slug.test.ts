import { describe, expect, it } from "vitest";
import { generateSlug, SLUG_ALPHABET, SLUG_LENGTH } from "@/modules/venues/domain/slug";

describe("venue slugs", () => {
  it("are 8 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generateSlug();
      expect(slug).toHaveLength(SLUG_LENGTH);
      expect(slug).toMatch(/^[a-z2-9]+$/);
      expect(slug).not.toMatch(/[01ilo]/);
    }
  });

  it("leave out the lookalikes and nothing else", () => {
    expect(SLUG_ALPHABET).toHaveLength(31);
    expect(new Set(SLUG_ALPHABET).size).toBe(31);
  });

  it("use every position of the alphabet", () => {
    let next = 0;
    const slug = generateSlug(() => next++ % SLUG_ALPHABET.length);
    expect(slug).toBe(SLUG_ALPHABET.slice(0, SLUG_LENGTH));
  });

  it("differ between calls", () => {
    const slugs = new Set(Array.from({ length: 1000 }, () => generateSlug()));
    expect(slugs.size).toBe(1000);
  });
});
