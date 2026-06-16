import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import type { Pitch, User } from "@/generated/prisma/client.js";

export async function seedFavorites(pitches: Pitch[], users: User[]) {
  console.log("Seeding favorites...");

  const favorites = [];

  for (const user of users) {
    // Each user favorites between 1 and 6 pitches
    const favoriteCount = faker.number.int({ min: 1, max: 6 });
    const selectedPitches = faker.helpers.arrayElements(pitches, favoriteCount);

    for (const pitch of selectedPitches) {
      const favorite = await prisma.favorite.create({
        data: {
          userId: user.id,
          pitchId: pitch.id,
          createdAt: faker.date.past({ years: 1 }),
        },
      });
      favorites.push(favorite);
    }
  }

  console.log(`Successfully seeded ${favorites.length} favorites.`);
  return { favorites };
}
