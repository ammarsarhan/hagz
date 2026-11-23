import { z } from "zod";
import { CheckInWindow } from "./check-in";
import { GroundEnvironment, GroundSize, GroundSport, GroundSurface } from "./grounds";
import { listOf } from "./venue-search";

// Open games (PR 4.7, docs/listings.md): a player lists their app booking as needing players, and
// others join from the feed or the share link. Each joined player owes the booker `sharePrice` and
// the venue `joinFee`, in person.

const Instant = z.iso.datetime();
const LocalDate = z.iso
  .date()
  .meta({ description: "A calendar day in the venue's timezone.", example: "2026-12-03" });

export const ListingStatus = z.enum(["WAITING", "OPEN", "CLOSED", "CANCELLED"]).meta({
  id: "ListingStatus",
  description:
    "`WAITING`: asked for at checkout, opens once the booking is confirmed. `CLOSED`: turned off by the booker. `CANCELLED`: the booking was cancelled. Full and started are worked out, not stored.",
});

const Note = z.string().trim().max(300);

// Each player's share of a booking: the total over the ground's players (playersOn), rounded up to a
// whole currency unit (100 minor units). The server prices listings with it; the app's review step
// shows it before booking.
export const shareOf = (total: number, players: number) => Math.ceil(total / players / 100) * 100;

export const ListingRequest = z
  .object({
    neededPlayers: z.int().min(1).max(21).meta({
      description: "Players wanted, besides the booker; at most the ground's players less one.",
    }),
    note: Note.optional().meta({ description: "Shown to everyone, e.g. the level." }),
  })
  .meta({ id: "ListingRequest" });

export const UpdateListing = z
  .object({
    neededPlayers: ListingRequest.shape.neededPlayers.optional().meta({
      description: "Raise up to the cap, or lower down to the players already joined.",
    }),
    note: Note.nullable().optional(),
  })
  .meta({ id: "UpdateListing" });

export const ListingPlayer = z
  .object({
    customerId: z.uuid(),
    firstName: z.string(),
    phone: z.string().nullable(),
    joinedAt: Instant,
    reliability: z
      .object({
        games: z
          .int()
          .meta({ description: "Open games they joined where the venue checked people in." }),
        showedUp: z.int().meta({ description: "Of those, the ones they checked in at." }),
      })
      .meta({
        description: "Games where the venue checked in none of the joined players don't count.",
      }),
    checkedInAt: Instant.nullable(),
  })
  .meta({ id: "ListingPlayer" });

// What the booker sees on their booking.
export const BookerListing = z
  .object({
    id: z.uuid(),
    status: ListingStatus,
    neededPlayers: z.int(),
    playerCount: z.int(),
    note: z.string().nullable(),
    sharePrice: z.int().meta({ description: "Each player pays the booker this, in minor units." }),
    joinFee: z.int().meta({ description: "Each player pays the venue this, in minor units." }),
    players: z.array(ListingPlayer).meta({ description: "Joined players, first to join first." }),
  })
  .meta({ id: "BookerListing" });

export const Game = z
  .object({
    id: z.uuid(),
    status: ListingStatus,
    joinable: z.boolean().meta({ description: "Open, not full and not started." }),
    startsAt: Instant,
    endsAt: Instant,
    timezone: z.string().meta({ example: "Africa/Cairo" }),
    currency: z.string().meta({ example: "EGP" }),
    venue: z.object({
      id: z.uuid(),
      slug: z.string(),
      name: z.string().nullable(),
      area: z.string().nullable(),
    }),
    ground: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      sport: GroundSport,
      size: GroundSize,
    }),
    distanceKm: z.number().nullable().meta({ description: "From the point searched, if any." }),
    neededPlayers: z.int(),
    playerCount: z.int(),
    spotsLeft: z.int(),
    note: z.string().nullable(),
    booker: z.object({ firstName: z.string() }),
    sharePrice: z.int(),
    joinFee: z.int(),
    me: z
      .object({
        booker: z.boolean(),
        status: z.enum(["JOINED", "LEFT", "REMOVED"]).nullable(),
        checkIn: CheckInWindow.nullable().meta({
          description: "Joined players: when to show the code.",
        }),
      })
      .nullable()
      .meta({ description: "Null for guests." }),
    players: z.array(z.string()).nullable().meta({
      description: "Joined players' first names, once you've joined (or for the booker).",
    }),
    bookerPhone: z.string().nullable().meta({
      description: "Once you've joined, until 24 hours after kick-off.",
    }),
  })
  .meta({ id: "Game" });

export const GamesQuery = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(100).default(25).meta({ description: "Kilometres." }),
    area: z.uuid().optional().meta({ description: "A location id; its sub-areas included." }),
    sport: GroundSport.optional(),
    size: GroundSize.optional(),
    date: LocalDate.optional(),
    surface: listOf(GroundSurface.options, "Any of these surfaces."),
    setting: listOf(GroundEnvironment.options, "Any of these: indoor, outdoor or covered."),
    fromHour: z.coerce
      .number()
      .int()
      .min(0)
      .max(23)
      .optional()
      .meta({ description: "Starting at this hour or later, at the venue." }),
    toHour: z.coerce
      .number()
      .int()
      .min(1)
      .max(24)
      .optional()
      .meta({ description: "Starting before this hour, at the venue." }),
    priceMax: z.coerce.number().int().min(0).optional().meta({
      description: "In minor units: a player's share and joining fee together, at most this.",
    }),
    spots: z.coerce
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .meta({ description: "At least this many spots left (to join with friends)." }),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .meta({ id: "GamesQuery" });

export const GamePage = z
  .object({ data: z.array(Game), nextCursor: z.string().nullable() })
  .meta({ id: "GamePage" });

export const MyGamesQuery = z
  .object({
    when: z.enum(["upcoming", "past"]).default("upcoming"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .meta({ id: "MyGamesQuery" });

export const GameList = z.object({ data: z.array(Game) }).meta({ id: "GameList" });

// What the venue sees on the booking: who to expect and what each owes the venue.
export const StaffGame = z
  .object({
    expectedPlayers: z.int().meta({ description: "Joined players, final at kick-off." }),
    players: z.array(z.object({ customerId: z.uuid(), firstName: z.string() })),
    joinFee: z.int().meta({ description: "Each player owes the venue this." }),
    feePlayers: z.int().meta({
      description:
        "Players the joining fee is due for: those checked in, or every joined player if none were.",
    }),
  })
  .meta({ id: "StaffGame" });

export type ListingStatus = z.infer<typeof ListingStatus>;
export type ListingRequest = z.infer<typeof ListingRequest>;
export type UpdateListing = z.infer<typeof UpdateListing>;
export type ListingPlayer = z.infer<typeof ListingPlayer>;
export type BookerListing = z.infer<typeof BookerListing>;
export type Game = z.infer<typeof Game>;
export type GamesQuery = z.infer<typeof GamesQuery>;
export type GamePage = z.infer<typeof GamePage>;
export type MyGamesQuery = z.infer<typeof MyGamesQuery>;
export type GameList = z.infer<typeof GameList>;
export type StaffGame = z.infer<typeof StaffGame>;
