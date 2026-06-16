import ReviewService from "@/domains/pitches/services/reviews.service.js";
import { createReviewSchema } from "@/domains/pitches/pitches.validator.js";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createFactory } from "hono/factory";
import { authorize } from "@/domains/auth/auth.middleware.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";

const reviewService = new ReviewService();
const factory = createFactory();

export const createReviewHandler = factory.createHandlers(
    authorize({ required: true }),
    zValidator("json", createReviewSchema),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        
        if (!pitchId)
            throw new NotFoundError("Pitch ID was not provided. Could not find pitch.", ERROR_CODES.PITCH_NOT_FOUND);

        const { rating, comment } = c.req.valid("json");

        const review = await reviewService.createReview(userId, pitchId, rating, comment);
        return c.json({ success: true, data: review }, 201);
    }
);

export const fetchPitchReviewsHandler = factory.createHandlers(
    zValidator("query", z.object({ cursor: z.string().optional() })),
    async (c) => {
        const { cursor } = c.req.valid("query");
        const pitchId = c.req.param("pitchId");
        
        if (!pitchId)
            throw new NotFoundError("Pitch ID was not provided. Could not find pitch.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const result = await reviewService.fetchPitchReviews(pitchId, cursor);
        return c.json({ success: true, data: { ...result } }, 200);
    }
);

export const deleteReviewHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const reviewId = c.req.param("reviewId");

        if (!reviewId)
            throw new NotFoundError("Could not find review with the specified ID.", ERROR_CODES.REVIEW_NOT_FOUND);

        const review = await reviewService.deleteReview(userId, reviewId);
        return c.json({ success: true, data: review }, 200);
    }
);
