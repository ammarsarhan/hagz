import { faker } from "@faker-js/faker";
import { hashPassword } from "@/shared/lib/utils/hash.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { UserRole, UserStatus, Language, NotificationChannel } from "@/generated/prisma/enums.js";

export async function seedUsers() {
  console.log("Seeding users...");

  const password = await hashPassword("Password123!");
  
  // Get all areas to assign to users
  const areas = await prisma.area.findMany();
  if (areas.length === 0) {
    throw new Error("No areas found. Please seed locations first.");
  }

  const users = [];

  // 50 Regular Users
  for (let i = 0; i < 50; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const phone = faker.helpers.fromRegExp("+201[0125][0-9]{8}");

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        firstName,
        lastName,
        phone,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        password,
        isVerified: true,
        status: UserStatus.ACTIVE,
        preferences: {
          create: {
            role: UserRole.USER,
            language: Language.EN,
            notifications: [NotificationChannel.WHATSAPP],
            timezone: "Africa/Cairo",
            areaId: faker.helpers.arrayElement(areas).id,
            sport: [faker.helpers.arrayElement(["FOOTBALL", "PADEL"]) as any],
          }
        }
      }
    });
    users.push(user);
  }

  // 30 Owners
  const owners = [];
  
  for (let i = 0; i < 30; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const phone = faker.helpers.fromRegExp(/\+201[0125][0-9]{8}/);

    const owner = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        firstName,
        lastName,
        phone,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        password,
        isVerified: true,
        status: UserStatus.ACTIVE,
        preferences: {
          create: {
            role: UserRole.OWNER,
            language: Language.EN,
            notifications: [NotificationChannel.WHATSAPP],
            timezone: "Africa/Cairo",
            areaId: faker.helpers.arrayElement(areas).id,
          }
        }
      }
    });
    owners.push(owner);
  }

  // 60 Managers
  const managers = [];
  
  for (let i = 0; i < 60; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const phone = faker.helpers.fromRegExp(/\+201[0125][0-9]{8}/);

    const manager = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        firstName,
        lastName,
        phone,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        password,
        isVerified: true,
        status: UserStatus.ACTIVE,
        preferences: {
          create: {
            role: UserRole.MANAGER,
            language: Language.EN,
            notifications: [NotificationChannel.WHATSAPP],
            timezone: "Africa/Cairo",
            areaId: faker.helpers.arrayElement(areas).id,
          }
        }
      }
    });
    managers.push(manager);
  }

  console.log(`Successfully seeded ${users.length} users, ${owners.length} owners, and ${managers.length} managers.`);
  return { users, owners, managers };
}
