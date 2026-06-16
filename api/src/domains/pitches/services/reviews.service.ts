import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";
import { BadRequestError, ERROR_CODES, NotFoundError, UnauthorizedError } from "@/shared/lib/utils/error.js";
import prisma from "@/shared/lib/utils/prisma.js";

export default class ReviewService {
    // Helper to update pitch denormalized rating fields.
    static readonly updatePitchRatingFields = async (tx: TransactionClient, pitchId: string) => {
        const reviews = await tx.review.findMany({
            where: { pitchId },
            select: { rating: true }
        });

        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount 
            : 0;

        await tx.pitch.update({
            where: { id: pitchId },
            data: {
                averageRating,
                reviewCount
            }
        });
    }

    createReview = async (userId: string, pitchId: string, rating: number, comment?: string) => {
        return await prisma.$transaction(async (tx) => {
            // Check if user has already reviewed this pitch (one review per user per pitch).
            const existing = await tx.review.findFirst({
                where: { userId, pitchId }
            });

            if (existing) {
                throw new BadRequestError("You have already reviewed this pitch.", ERROR_CODES.REVIEW_ALREADY_EXISTS);
            }

            const review = await tx.review.create({
                data: {
                    userId,
                    pitchId,
                    rating,
                    comment
                }
            });

            await ReviewService.updatePitchRatingFields(tx, pitchId);
            return review;
        });
    }

    fetchPitchReviews = async (pitchId: string, cursor?: string) => {
        const limit = 10;
        const take = limit + 1;

        const reviews = await prisma.review.findMany({
            where: { pitchId },
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true
                    }
                }
            },
            take,
            ...(cursor && {
                cursor: { id: cursor },
                skip: 1,
            }),
        });

        const data = reviews.length > limit ? reviews.slice(0, -1) : reviews;
        const next = reviews.length > limit ? data[data.length - 1].id : null;

        return { reviews: data, cursor: next };
    }

    deleteReview = async (userId: string, reviewId: string) => {
        return await prisma.$transaction(async (tx) => {
            const review = await tx.review.findUnique({
                where: { id: reviewId }
            });

            if (!review) throw new NotFoundError("Could not find review with the specified ID.", ERROR_CODES.REVIEW_NOT_FOUND);

            // Make sure the user deleting the booking actually wrote the booking.
            if (review.userId !== userId) throw new UnauthorizedError("You are not authorized to delete this review.", ERROR_CODES.UNAUTHORIZED);

            const deleted = await tx.review.delete({
                where: { id: reviewId }
            });

            await ReviewService.updatePitchRatingFields(tx, review.pitchId);
            return deleted;
        });
    }
}
