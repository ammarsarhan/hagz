import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import type { Pitch, User } from "@/generated/prisma/client.js";

export async function seedReviews(pitches: Pitch[], users: User[]) {
  console.log("Seeding reviews...");

  const reviews = [];

  for (const pitch of pitches) {
    // Generate between 3 and 12 reviews per pitch
    const reviewCount = faker.number.int({ min: 3, max: 12 });
    let totalRating = 0;

    // Pick a subset of users to leave reviews
    const reviewers = faker.helpers.arrayElements(users, reviewCount);

    for (const user of reviewers) {
      // Mostly positive reviews
      const rating = faker.number.int({ min: 3, max: 5 });
      totalRating += rating;

      const review = await prisma.review.create({
        data: {
          pitchId: pitch.id,
          userId: user.id,
          rating,
          comment: faker.helpers.maybe(() => faker.lorem.sentences({ min: 1, max: 3 }), { probability: 0.8 }),
          createdAt: faker.date.past({ years: 1 }),
        },
      });
      reviews.push(review);
    }

    // Update pitch with aggregated data
    await prisma.pitch.update({
      where: { id: pitch.id },
      data: {
        averageRating: totalRating / reviewCount,
        reviewCount: reviewCount,
      },
    });
  }

  console.log(`Successfully seeded ${reviews.length} reviews.`);
  return { reviews };
}
