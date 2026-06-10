import prisma from "@/shared/lib/utils/prisma.js";
import { seedCustomers } from "@/../prisma/seeds/customers.js";
import { UserRole } from "@/generated/prisma/enums.js";

async function run() {
  try {
    const pitches = await prisma.pitch.findMany();
    const users = await prisma.user.findMany({ 
      where: { preferences: { role: UserRole.USER } } 
    });
    await seedCustomers(pitches, users);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
