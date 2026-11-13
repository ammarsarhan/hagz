import type { components } from "@hagz/api";
import type { AddressPart } from "./places";

export type Location = components["schemas"]["Location"];

// Players browse by area, so a venue is filed under one of ours, not Google's. Google says where
// the pin is in its own words ("Sarayat El Maadi", "Maadi", "Cairo Governorate"); this picks the
// area of ours that means the same, smallest first, and the owner confirms it (Figma 295:2).
//
// Matching is on names, not ids: our locations are seeded per marketplace and Google knows nothing
// about them. Both sides are asked for the app's language, so the names line up.

// Google's parts, from the smallest place to the largest. Anything else (a street, a building) is
// too small to be an area.
const PART_ORDER = [
  "neighborhood",
  "sublocality_level_2",
  "sublocality_level_1",
  "sublocality",
  "locality",
  "administrative_area_level_3",
  "administrative_area_level_2",
  "administrative_area_level_1",
];

// Same place, different spelling: "Al Maadi", "El-Ma'adi" and "Maadi" are one area, and so are
// "المعادي" and "معادي". Lowercased, stripped of the Arabic article and of everything that isn't a
// letter or a digit, with Arabic's interchangeable letters folded together.
const normalize = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFKD")
    // Latin accents and Arabic diacritics.
    .replace(/[̀-ًͯ-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/ة/g, "ه")
    .replace(/^(a|e)l[\s-]/, "")
    .replace(/^ال/, "")
    .replace(/\b(governorate|city of|district)\b/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

// The smallest of our areas Google's address names, or null when it names none of them. Several of
// ours can share a name (two "Nasr City" in different governorates), so a match deeper in the tree
// wins: it's the one whose parent the address also names.
export const matchArea = (parts: AddressPart[], locations: Location[]): Location | null => {
  const byName = new Map<string, Location[]>();
  for (const location of locations) {
    const name = normalize(location.name);
    byName.set(name, [...(byName.get(name) ?? []), location]);
  }
  const named = new Set(parts.map((part) => normalize(part.name)));

  for (const type of PART_ORDER) {
    const part = parts.find((candidate) => candidate.types.includes(type));
    if (!part) continue;
    const matches = byName.get(normalize(part.name));
    if (!matches?.length) continue;
    if (matches.length === 1) return matches[0] ?? null;
    // Ambiguous: prefer the one whose parent the same address also names.
    const byId = new Map(locations.map((location) => [location.id, location]));
    const confirmed = matches.find((match) => {
      const parent = match.parentId ? byId.get(match.parentId) : undefined;
      return parent ? named.has(normalize(parent.name)) : false;
    });
    return confirmed ?? matches[0] ?? null;
  }
  return null;
};

// An area with where it sits above it: "Maadi" and "Cairo". The line is the top of its tree (the
// governorate or city), which is how players read an address, and is empty for a top-level area.
export const areaLabel = (
  location: Location,
  locations: Location[],
): { name: string; within: string } => {
  const byId = new Map(locations.map((candidate) => [candidate.id, candidate]));
  let top = location;
  // Guarded against a loop in the data, which would otherwise hang the screen.
  for (let step = 0; step < 10; step += 1) {
    const parent = top.parentId ? byId.get(top.parentId) : undefined;
    if (!parent) break;
    top = parent;
  }
  return { name: location.name, within: top.id === location.id ? "" : top.name };
};

// The areas a venue can be filed under: the leaves of the tree, which is where venues sit, with
// their parent's name for telling two of the same name apart. Sorted by name, in the app's
// language, for the "Choose a different area" list.
export const choosableAreas = (
  locations: Location[],
): { location: Location; name: string; within: string }[] => {
  const parents = new Set(locations.map((location) => location.parentId).filter(Boolean));
  return locations
    .filter((location) => !parents.has(location.id))
    .map((location) => ({ location, ...areaLabel(location, locations) }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
