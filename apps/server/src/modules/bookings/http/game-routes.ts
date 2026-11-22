import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { bookingView } from "../application/booking-view";
import {
  closeListing,
  gamesFeed,
  gameView,
  joinGame,
  leaveGame,
  listBooking,
  myGames,
  removePlayer,
  updateListing,
} from "../application/listings";
import * as route from "./definitions/games";

// `mine` is registered before `{gameId}` so it isn't read as an id.
export const bookingsGameRoutes = createRouter()
  .openapi(route.listGames, async (c) =>
    c.json(
      await gamesFeed(
        c.req.valid("query"),
        c.get("customer")?.customerId ?? null,
        requestLanguage(c),
      ),
      200,
    ),
  )
  .openapi(route.myGames, async (c) =>
    c.json(
      {
        data: await myGames(c.get("customer").customerId, c.req.valid("query"), requestLanguage(c)),
      },
      200,
    ),
  )
  .openapi(route.getGame, async (c) =>
    c.json(
      await gameView(
        c.req.valid("param").gameId,
        c.get("customer")?.customerId ?? null,
        requestLanguage(c),
      ),
      200,
    ),
  )
  .openapi(route.joinGame, async (c) => {
    const { gameId } = c.req.valid("param");
    const { customerId } = c.get("customer");
    await joinGame(customerId, gameId);
    return c.json(await gameView(gameId, customerId, requestLanguage(c)), 200);
  })
  .openapi(route.leaveGame, async (c) => {
    const { gameId } = c.req.valid("param");
    const { customerId } = c.get("customer");
    await leaveGame(customerId, gameId);
    return c.json(await gameView(gameId, customerId, requestLanguage(c)), 200);
  })
  .openapi(route.listBooking, async (c) => {
    const { bookingId } = c.req.valid("param");
    await listBooking(c.get("customer").customerId, bookingId, c.req.valid("json"));
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  })
  .openapi(route.updateListing, async (c) => {
    const { bookingId } = c.req.valid("param");
    await updateListing(c.get("customer").customerId, bookingId, c.req.valid("json"));
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  })
  .openapi(route.closeListing, async (c) => {
    const { bookingId } = c.req.valid("param");
    await closeListing(c.get("customer").customerId, bookingId);
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  })
  .openapi(route.removePlayer, async (c) => {
    const { bookingId, customerId } = c.req.valid("param");
    await removePlayer(c.get("customer").customerId, bookingId, customerId);
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  });
