import { playersOn, type GroundSize, type GroundSport } from "@hagz/contracts";

// Open games (PR 4.7, docs/listings.md). Pure: what each player owes, and the limits.

// Amounts are whole currency units: minor units per unit.
const UNIT = 100;

// The booker's phone stays visible to joined players this long after kick-off.
export const PHONE_HOURS_AFTER_START = 24;
// The booker can report joined players who didn't come this long after the end.
export const NO_SHOW_REPORT_HOURS = 48;
// Staff record how many came from kick-off until this long after the end.
export const ARRIVED_WINDOW_HOURS = 24;

// Each player's share of the booking: the total over the ground's players, rounded up to a unit.
export const shareOf = (total: number, players: number) => Math.ceil(total / players / UNIT) * UNIT;

// The joining fee: the marketplace's rate (basis points) of the share, rounded to a unit.
export const joinFeeOf = (share: number, rate: number) =>
  Math.round((share * rate) / 10_000 / UNIT) * UNIT;

// Players a booker can ask for: the ground's players less the booker.
export const maxNeeded = (sport: GroundSport, size: GroundSize) => playersOn(sport, size) - 1;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
