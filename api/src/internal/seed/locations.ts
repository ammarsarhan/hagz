import prisma from "@/shared/lib/utils/prisma.js";

const locations = [
  {
    name: "Alexandria",
    areas: [
      "Smouha",
      "Abees",
      "Seyouf",
      "Sporting",
      "Miami",
      "Sidi Gaber",
      "Gleem",
      "Rushdy",
      "Ibrahimia",
      "Cleopatra",
      "Raml Station",
      "Mansheya",
      "Bab Sharqi",
      "Attarin",
      "Azarita",
      "Camp Caesar",
      "Stanley",
      "Saba Pasha",
      "Zizinia",
      "San Stefano",
      "Roushdy",
      "Fleming",
      "Sidi Bishr",
      "Mandara",
      "Montazah",
      "Maamoura",
      "Abu Qir",
      "New Borg El Arab",
      "Borg El Arab",
      "Agami",
      "Hannoville",
      "Bitash",
      "King Mariout",
      "Amreya",
      "Dekheila",
      "Mex",
      "Anfushi",
      "Gomrok",
      "Karmouz",
      "Wardiyan",
      "El Hadara",
      "El Labban",
      "Moharam Bek",
      "El Asafra",
      "El Dekhela",
    ],
  },
  {
    name: "Cairo",
    areas: [
      "Maadi",
      "Zamalek",
      "Heliopolis",
      "Nasr City",
      "New Cairo",
      "Fifth Settlement",
      "Rehab",
      "Sheraton",
      "Ain Shams",
      "Abbasiya",
      "Downtown",
      "Garden City",
      "Dokki",
      "Agouza",
      "Mohandessin",
      "Haram",
      "Faisal",
    ],
  },
  {
    name: "Giza",
    areas: [
      "6th of October",
      "Sheikh Zayed",
      "Hadayek El Ahram",
      "Warraq",
      "Imbaba",
      "Boulaq El Dakrour",
      "Omraneya",
      "Haram",
      "Kerdasa",
    ],
  },
];

export async function seed() {
  console.log("Seeding governorates and areas...");

  for (const item of locations) {
    const governorate = await prisma.governorate.upsert({
      where: { name: item.name },
      update: {},
      create: { name: item.name },
    });

    console.log(`Created governorate: ${governorate.name}.`);

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

  console.log("Location seed complete.");
}