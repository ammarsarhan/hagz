import prisma from "@/shared/lib/utils/prisma.js";
import locations from "@/shared/types/locations.js";

export async function seedLocations() {
  console.log("Seeding governorates and areas...");

  for (const item of locations) {
    const governorate = await prisma.governorate.upsert({
      where: { name: item.name.en },
      update: {},
      create: { name: item.name.en },
    });

    for (const area of item.areas) {
      await prisma.area.upsert({
        where: {
          name_governorateId: {
            name: area.en,
            governorateId: governorate.id,
          },
        },
        update: {},
        create: {
          name: area.en,
          governorateId: governorate.id,
        },
      });
    }
  }

  const governorateCount = await prisma.governorate.count();
  const areaCount = await prisma.area.count();
  console.log(`Successfully seeded ${governorateCount} governorates and ${areaCount} areas.`);
}
