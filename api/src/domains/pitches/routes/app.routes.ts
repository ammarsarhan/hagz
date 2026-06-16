import { Hono } from "hono";
import { addFavoriteHandler, fetchPitchesFeedHandler, fetchUserFavoritesHandler, getUserPitchHandler, removeFavoriteHandler } from "@/domains/pitches/handlers/pitches.handlers.js";
import { createReviewHandler, deleteReviewHandler, fetchPitchReviewsHandler } from "@/domains/pitches/handlers/reviews.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get("/favorites", ...fetchUserFavoritesHandler)
    .post("/feed", ...fetchPitchesFeedHandler)
    .get("/:pitchId", ...getUserPitchHandler)
    .post("/:pitchId/reviews", ...createReviewHandler)
    .get("/:pitchId/reviews", ...fetchPitchReviewsHandler)
    .delete("/reviews/:reviewId", ...deleteReviewHandler)
    .post("/:pitchId/favorite", ...addFavoriteHandler)
    .delete("/:pitchId/favorite", ...removeFavoriteHandler)

export default app;
export type AppType = typeof app;
