import { createRoute, z } from "@hono/zod-openapi";
import {
  Booking,
  Game,
  GameList,
  GamePage,
  GamesQuery,
  ListingRequest,
  MyGamesQuery,
  RecordArrived,
  StaffBookingDetail,
  UpdateListing,
} from "@hagz/contracts";
import { requireVenueAccess } from "@/modules/venues";
import {
  CUSTOMER_BEARER,
  optionalCustomer,
  requireCustomer,
  requireStaff,
  STAFF_BEARER,
} from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// Open games (PR 4.7, docs/listings.md): the feed and joining, the booker's listing on their
// booking, and the venue recording how many came.

const tags = ["Open games"];
const security = [{ [CUSTOMER_BEARER]: [] }];
const guestOrCustomer: Record<string, string[]>[] = [{ [CUSTOMER_BEARER]: [] }, {}];
const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED");
const gameParams = z.object({ gameId: z.uuid() });
const bookingParams = z.object({ bookingId: z.uuid() });
const playerParams = bookingParams.extend({ customerId: z.uuid() });
const game = { description: "The game", ...json(Game) };
const booking = { description: "Your booking, with its listing", ...json(Booking) };
const notYours = problemResponse(
  "BOOKING_NOT_FOUND: none of yours with that id, or GAME_NOT_FOUND: it isn't listed.",
);

// Routes declare their middleware inline: spread from a shared object, the route types lose `c.var`.

export const listGames = createRoute({
  method: "get",
  path: "/games",
  tags,
  summary: "Games needing players",
  description:
    "Open games that aren't full or started, soonest first, then nearest to `latitude`/`longitude`. Public; signed in, each game carries `me`.",
  middleware: [optionalCustomer] as const,
  security: guestOrCustomer,
  request: { query: GamesQuery },
  responses: {
    200: { description: "A page of games", ...json(GamePage) },
    400: problemResponse("INVALID_CURSOR"),
  },
});

export const myGames = createRoute({
  method: "get",
  path: "/games/mine",
  tags,
  summary: "Games I've joined",
  middleware: [requireCustomer] as const,
  security,
  request: { query: MyGamesQuery },
  responses: { 200: { description: "The games", ...json(GameList) }, 401: unauthenticated },
});

export const getGame = createRoute({
  method: "get",
  path: "/games/{gameId}",
  tags,
  summary: "One game",
  description:
    "Names of the other players and the booker's number only once you've joined. Public, for the share link.",
  middleware: [optionalCustomer] as const,
  security: guestOrCustomer,
  request: { params: gameParams },
  responses: { 200: game, 404: problemResponse("GAME_NOT_FOUND") },
});

export const joinGame = createRoute({
  method: "post",
  path: "/games/{gameId}/join",
  tags,
  summary: "Join a game",
  description:
    "You owe the booker `sharePrice` and the venue `joinFee`, in person. Hagz doesn't guarantee the players will show up or that the game will go ahead.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: gameParams },
  responses: {
    200: game,
    401: unauthenticated,
    403: problemResponse("REMOVED_FROM_GAME: the booker removed you."),
    404: problemResponse("GAME_NOT_FOUND"),
    409: problemResponse(
      "GAME_NOT_OPEN, GAME_FULL, GAME_STARTED, OWN_GAME, ALREADY_JOINED, or GAME_CLASH: you have a game or a booking at this time.",
    ),
  },
});

export const leaveGame = createRoute({
  method: "post",
  path: "/games/{gameId}/leave",
  tags,
  summary: "Leave a game",
  description: "Until kick-off. Nothing is owed.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: gameParams },
  responses: {
    200: game,
    401: unauthenticated,
    404: problemResponse("GAME_NOT_FOUND"),
    409: problemResponse("NOT_JOINED or GAME_STARTED"),
  },
});

export const listBooking = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/listing",
  tags,
  summary: "Look for players",
  description:
    "A confirmed booking you made in the app, before it starts. A listing you turned off opens again.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams, ...body(ListingRequest) },
  responses: {
    200: booking,
    401: unauthenticated,
    404: notYours,
    409: problemResponse("BOOKING_NOT_LISTABLE or ALREADY_LISTED"),
    422: problemResponse("TOO_MANY_PLAYERS (with `maximum`)"),
  },
});

export const updateListing = createRoute({
  method: "patch",
  path: "/bookings/{bookingId}/listing",
  tags,
  summary: "Change how many players you need, or the note",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams, ...body(UpdateListing) },
  responses: {
    200: booking,
    401: unauthenticated,
    404: notYours,
    409: problemResponse("GAME_NOT_OPEN, GAME_STARTED, or BELOW_JOINED (with `joined`)"),
    422: problemResponse("TOO_MANY_PLAYERS (with `maximum`)"),
  },
});

export const closeListing = createRoute({
  method: "delete",
  path: "/bookings/{bookingId}/listing",
  tags,
  summary: "Stop looking for players",
  description: "Only while nobody has joined; remove them first.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams },
  responses: {
    200: booking,
    401: unauthenticated,
    404: notYours,
    409: problemResponse("GAME_NOT_OPEN or GAME_HAS_PLAYERS"),
  },
});

export const removePlayer = createRoute({
  method: "delete",
  path: "/bookings/{bookingId}/listing/players/{customerId}",
  tags,
  summary: "Remove a player from your game",
  description: "Until kick-off. They can't join this game again.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: playerParams },
  responses: {
    200: booking,
    401: unauthenticated,
    404: notYours,
    409: problemResponse("NOT_JOINED or GAME_STARTED"),
  },
});

export const reportNoShow = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/listing/players/{customerId}/no-show",
  tags,
  summary: "Report a player who didn't come",
  description: "Within 48 hours of a game that was played. Counts in their reliability.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: playerParams },
  responses: {
    200: booking,
    401: unauthenticated,
    404: notYours,
    409: problemResponse("NOT_JOINED or REPORT_WINDOW_CLOSED"),
  },
});

export const recordArrived = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/arrived",
  tags: ["Venue bookings"],
  summary: "Record how many of an open game's players came",
  description:
    "Needs `bookings: manage`. From kick-off until 24 hours after the end, and correctable in that time. Left unrecorded, everyone expected counts as having come.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security: [{ [STAFF_BEARER]: [] }],
  request: {
    params: z.object({ venueId: z.uuid(), bookingId: z.uuid() }),
    ...body(RecordArrived),
  },
  responses: {
    200: { description: "The booking", ...json(StaffBookingDetail) },
    401: unauthenticated,
    403: problemResponse("PERMISSION_DENIED"),
    404: problemResponse("BOOKING_NOT_FOUND, or GAME_NOT_FOUND: no open game with players."),
    409: problemResponse("ARRIVED_WINDOW_CLOSED"),
    422: problemResponse("MORE_THAN_JOINED (with `joined`)"),
  },
});
