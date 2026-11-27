import { playersOn, type GroundSize, type GroundSport } from "@hagz/contracts";

// Open games (PR 4.7, docs/listings.md). Pure: what each player owes, and the limits.

// Amounts are whole currency units: minor units per unit.
const UNIT = 100;

// The booker's phone shows to joined players from this long before kick-off (user, 2026-11-27, so
// joining just to collect numbers and leaving stops paying off)...
export const PHONE_HOURS_BEFORE_START = 12;
// ...and stays visible this long after it.
export const PHONE_HOURS_AFTER_START = 24;

// Each player's share of the booking: in contracts, so the app's review step shows the same.
export { shareOf } from "@hagz/contracts";

// The joining fee: the marketplace's rate (basis points) of the share, rounded to a unit, and never
// less than the marketplace's minimum (user, 2026-11-25: 5 EGP in Egypt). A rate of 0 turns the fee
// off, minimum and all.
export const joinFeeOf = (share: number, rate: number, minimum: number) => {
  if (rate === 0) return 0;
  return Math.max(Math.round((share * rate) / 10_000 / UNIT) * UNIT, minimum);
};

// Players a booker can ask for: the ground's players less the booker.
export const maxNeeded = (sport: GroundSport, size: GroundSize) => playersOn(sport, size) - 1;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
