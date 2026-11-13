import { z } from "zod";

// Grounds and their weekly hours (PR 2.4). Prices are per hour, in minor units; slots are whole
// hours.

export const GroundSport = z
  .enum(["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"])
  .meta({ id: "GroundSport" });
export const GroundSize = z
  .enum(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE", "STANDARD"])
  .meta({ id: "GroundSize", description: "`STANDARD` for sports without size variants." });
export const GroundSurface = z
  .enum(["NATURAL_GRASS", "ARTIFICIAL_TURF", "HARD_WOOD", "HARD_COURT", "CLAY", "OTHER"])
  .meta({ id: "GroundSurface" });
export const GroundEnvironment = z
  .enum(["INDOOR", "OUTDOOR", "COVERED"])
  .meta({ id: "GroundEnvironment", description: "`COVERED`: a roof with open sides." });
export const GroundStatus = z.enum(["ACTIVE", "MAINTENANCE"]).meta({
  id: "GroundStatus",
  description: "`MAINTENANCE`: temporarily unbookable.",
});
export const PriceTier = z.enum(["BASE", "PEAK", "DISCOUNT"]).meta({ id: "PriceTier" });

type Sport = z.infer<typeof GroundSport>;
type Size = z.infer<typeof GroundSize>;

// Which sizes each sport comes in.
export const SIZES_BY_SPORT = {
  FOOTBALL: ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"],
  PADEL: ["STANDARD"],
  TENNIS: ["STANDARD"],
  BASKETBALL: ["STANDARD"],
  VOLLEYBALL: ["STANDARD"],
} as const satisfies Record<Sport, readonly Size[]>;

export const sizeFitsSport = (sport: Sport, size: Size) =>
  (SIZES_BY_SPORT[sport] as readonly Size[]).includes(size);

// A ground's footprint on the layout grid (about 10 m a cell), landscape; VERTICAL swaps them.
// Fixed per sport and size so owners never size grounds (decided 2026-10-24).
export const FOOTPRINTS: Record<Sport, Partial<Record<Size, { width: number; height: number }>>> = {
  FOOTBALL: {
    FIVE_A_SIDE: { width: 4, height: 2 },
    SEVEN_A_SIDE: { width: 6, height: 4 },
    ELEVEN_A_SIDE: { width: 10, height: 7 },
  },
  PADEL: { STANDARD: { width: 2, height: 1 } },
  TENNIS: { STANDARD: { width: 4, height: 2 } },
  BASKETBALL: { STANDARD: { width: 3, height: 2 } },
  VOLLEYBALL: { STANDARD: { width: 2, height: 1 } },
};

export const MAXIMUM_GROUNDS = 100;
// Longest booking a ground can allow, in hours.
export const MAXIMUM_BOOKING_HOURS = 6;

const price = z.int().min(1).max(100_000_00).meta({ description: "Per hour, in minor units." });

const groundFields = {
  name: z.string().trim().min(1).max(40).meta({ example: "Pitch 1" }),
  sport: GroundSport,
  size: GroundSize,
  surface: GroundSurface,
  environment: GroundEnvironment,
  basePrice: price,
  peakPrice: price.nullable(),
  discountPrice: price.nullable(),
  minimumSlots: z
    .int()
    .min(1)
    .max(MAXIMUM_BOOKING_HOURS)
    .meta({ description: "Shortest booking, in hours." }),
  maximumSlots: z
    .int()
    .min(1)
    .max(MAXIMUM_BOOKING_HOURS)
    .meta({ description: "Longest booking, in hours." }),
};

export const CreateGround = z
  .object(groundFields)
  .refine((ground) => sizeFitsSport(ground.sport, ground.size), {
    message: "That size doesn't exist for that sport.",
    path: ["size"],
  })
  .refine((ground) => ground.minimumSlots <= ground.maximumSlots, {
    message: "The shortest booking can't be longer than the longest.",
    path: ["minimumSlots"],
  })
  .meta({ id: "CreateGround" });

// Only what's sent changes; the result is checked as a whole.
export const UpdateGround = z
  .object({ ...groundFields, status: GroundStatus })
  .partial()
  .refine((input) => Object.keys(input).length > 0, { message: "Nothing to change." })
  .meta({ id: "UpdateGround" });

export const Ground = z
  .object({
    id: z.uuid(),
    name: z.string().nullable(),
    sport: GroundSport,
    size: GroundSize,
    surface: GroundSurface,
    environment: GroundEnvironment,
    status: GroundStatus,
    position: z.int().min(0),
    basePrice: z.int(),
    peakPrice: z.int().nullable(),
    discountPrice: z.int().nullable(),
    minimumSlots: z.int(),
    maximumSlots: z.int(),
    openHours: z.int().min(0).meta({ description: "Open hours in its week; 0 until set." }),
  })
  .meta({ id: "Ground" });

export const ReorderGrounds = z
  .object({ groundIds: z.array(z.uuid()).max(MAXIMUM_GROUNDS) })
  .meta({ id: "ReorderGrounds" });

export const ScheduleHour = z
  .object({ hour: z.int().min(0).max(23), tier: PriceTier })
  .meta({ id: "ScheduleHour" });

// One day of the weekly template. Hours are local; hours past midnight belong in the next day.
export const ScheduleDay = z
  .object({
    dayOfWeek: z.int().min(0).max(6).meta({ description: "0 is Sunday." }),
    hours: z
      .array(ScheduleHour)
      .max(24)
      .refine((hours) => new Set(hours.map((h) => h.hour)).size === hours.length, {
        message: "Each hour once.",
      }),
  })
  .meta({ id: "ScheduleDay" });

export const WeekSchedule = z
  .object({
    days: z
      .array(ScheduleDay)
      .max(7)
      .refine((days) => new Set(days.map((d) => d.dayOfWeek)).size === days.length, {
        message: "Each day once.",
      })
      .meta({ description: "Days left out are closed." }),
  })
  .meta({ id: "WeekSchedule" });

export const CopySchedule = z
  .object({ groundIds: z.array(z.uuid()).min(1).max(MAXIMUM_GROUNDS) })
  .meta({ id: "CopySchedule" });

export type GroundSport = z.infer<typeof GroundSport>;
export type GroundSize = z.infer<typeof GroundSize>;
export type GroundSurface = z.infer<typeof GroundSurface>;
export type GroundEnvironment = z.infer<typeof GroundEnvironment>;
export type GroundStatus = z.infer<typeof GroundStatus>;
export type PriceTier = z.infer<typeof PriceTier>;
export type CreateGround = z.infer<typeof CreateGround>;
export type UpdateGround = z.infer<typeof UpdateGround>;
export type Ground = z.infer<typeof Ground>;
export type ReorderGrounds = z.infer<typeof ReorderGrounds>;
export type ScheduleHour = z.infer<typeof ScheduleHour>;
export type ScheduleDay = z.infer<typeof ScheduleDay>;
export type WeekSchedule = z.infer<typeof WeekSchedule>;
export type CopySchedule = z.infer<typeof CopySchedule>;
