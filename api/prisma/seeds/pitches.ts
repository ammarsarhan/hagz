import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { PitchTier, PitchStatus, AmenityName, Language } from "@/generated/prisma/enums.js";
import dataset from "@/shared/types/pitches.js";

export async function seedPitches() {
  console.log("Seeding pitches...");

  const areas = await prisma.area.findMany();
  const pitches = [];

  const tierCounts = {
    [PitchTier.ALPHA]: 20,
    [PitchTier.STANDARD]: 5,
    [PitchTier.PREMIUM]: 5,
  };

  const amenityPool: AmenityName[] = Object.values(AmenityName);
  let translationIndex = 0;

  for (const [tier, count] of Object.entries(tierCounts)) {
    for (let i = 0; i < count; i++) {
      const translation = dataset[translationIndex % dataset.length];
      translationIndex++;

      const pitch = await prisma.pitch.create({
        data: {
          name: translation.en.name,
          description: translation.en.description,
          taxId: faker.string.numeric(9),
          street: faker.location.streetAddress(),
          areaId: faker.helpers.arrayElement(areas).id,
          latitude: faker.location.latitude({ max: 31.28, min: 31.15 }),
          longitude: faker.location.longitude({ max: 30.10, min: 29.88 }),
          googleMapsLink: faker.internet.url(),
          status: PitchStatus.SUBMITTED,
          tier: tier as PitchTier,
          isFeatured: tier === PitchTier.PREMIUM,
          amenityList: faker.helpers.arrayElements(amenityPool, { min: 3, max: 8 }),
          translations: {
            create: [
              { locale: Language.EN, name: translation.en.name, description: translation.en.description },
              { locale: Language.AR, name: translation.ar.name, description: translation.ar.description },
            ],
          },
          ledger: {
            create: { balance: 0 },
          },
          events: {
            create: { status: PitchStatus.SUBMITTED, reason: "Seeded initial data" },
          },
        },
      });

      await Promise.all(
        pitch.amenityList.map((name, index) =>
          prisma.amenity.create({
            data: {
              pitchId: pitch.id,
              order: index + 1,
              name: name as AmenityName,
              description: faker.lorem.sentence(),
            },
          })
        )
      );

      pitches.push(pitch);
    }
  }

  console.log(`Successfully seeded ${pitches.length} pitches.`);
  return { pitches };
};
