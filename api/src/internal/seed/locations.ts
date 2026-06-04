import prisma from "@/shared/lib/utils/prisma.js";
import locations from "@/shared/types/locations.js";

export async function seed() {
  console.log("Seeding governorates and areas...");

  for (const item of locations) {
    const governorate = await prisma.governorate.upsert({
      where: { name: item.name },
      update: {},
      create: { name: item.name },
    });

    console.log(`Creating for ${governorate.name}:`);

    for (const area of item.areas) {
      await prisma.area.upsert({
        where: {
          name_governorateId: {
            name: area,
            governorateId: governorate.id,
          },
        },
        update: {},
        create: {
          name: area,
          governorateId: governorate.id,
        },
      });
    }

    console.log(`${item.areas.length} areas seeded.`);
  }

  console.log("Location seed completed successfully. Mabrook!");
};

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });