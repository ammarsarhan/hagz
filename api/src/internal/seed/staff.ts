import prisma from "@/shared/lib/utils/prisma.js";
import { seedStaff } from "@/../prisma/seeds/staff.js";
import { UserRole } from "@/generated/prisma/enums.js";

async function run() {
  try {
    const pitches = await prisma.pitch.findMany();
    const owners = await prisma.user.findMany({ 
      where: { preferences: { role: UserRole.OWNER } } 
    });
    const managers = await prisma.user.findMany({ 
      where: { preferences: { role: UserRole.MANAGER } } 
    });
    await seedStaff(pitches, owners, managers);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
