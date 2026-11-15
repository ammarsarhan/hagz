import type { TFunction } from "i18next";
import type { components } from "@hagz/api";

export type Ground = components["schemas"]["Ground"];
export type GroundSport = components["schemas"]["GroundSport"];
export type GroundSize = components["schemas"]["GroundSize"];
export type GroundSurface = components["schemas"]["GroundSurface"];
export type GroundEnvironment = components["schemas"]["GroundEnvironment"];

// In the order the add flow offers them (Figma 352:2, 353:2).
export const SPORTS: GroundSport[] = ["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"];
export const SURFACES: GroundSurface[] = [
  "ARTIFICIAL_TURF",
  "NATURAL_GRASS",
  "HARD_COURT",
  "HARD_WOOD",
  "CLAY",
  "OTHER",
];
export const ENVIRONMENTS: GroundEnvironment[] = ["OUTDOOR", "COVERED", "INDOOR"];

// What kind of ground it is, the way players say it: "5-a-side football", or just "Padel" for a
// sport that comes in one size.
export const kindOf = (t: TFunction, ground: Pick<Ground, "sport" | "size">) =>
  ground.size === "STANDARD"
    ? t(`screens.setup.grounds.sports.${ground.sport}`)
    : t(`screens.setup.grounds.footballSizes.${ground.size}`);

// The grey line under a ground's name: "5-a-side football · Artificial turf · Outdoor".
export const groundLine = (t: TFunction, ground: Ground) =>
  [
    kindOf(t, ground),
    t(`screens.setup.grounds.surfaces.${ground.surface}`),
    t(`screens.setup.grounds.environments.${ground.environment}`),
  ].join(" · ");
