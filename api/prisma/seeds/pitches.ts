import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { PitchTier, PitchStatus, AmenityName } from "@/generated/prisma/enums.js";

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

  for (const [tier, count] of Object.entries(tierCounts)) {
    for (let i = 0; i < count; i++) {
      const name = `${faker.company.name()} Sports Club`;
      
      const pitch = await prisma.pitch.create({
        data: {
          name,
          description: faker.lorem.paragraph(),
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
          // Ledger initialization
          ledger: {
            create: {
              balance: 0
            }
          },
          // Event logging
          events: {
            create: {
              status: PitchStatus.SUBMITTED,
              reason: "Seeded initial data"
            }
          }
        }
      });

      // Add actual Amenity records to match amenityList (denormalized)
      await Promise.all(pitch.amenityList.map((name, index) => 
        prisma.amenity.create({
          data: {
            pitchId: pitch.id,
            order: index,
            name: name as AmenityName,
            description: faker.lorem.sentence()
          }
        })
      ));

      pitches.push(pitch);
    }
  }

  console.log(`Successfully seeded ${pitches.length} pitches.`);
  return { pitches };
}
