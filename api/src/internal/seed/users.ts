import prisma from "@/shared/lib/utils/prisma.js";
import { seedUsers } from "@/../prisma/seeds/users.js";

async function run() {
  try {
    await seedUsers();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
