import prisma from "@/shared/lib/utils/prisma.js";
import { seedBookings } from "@/../prisma/seeds/bookings.js";
import { UserRole } from "@/generated/prisma/enums.js";

async function run() {
  try {
    const pitches = await prisma.pitch.findMany();
    const grounds = await prisma.ground.findMany();
    const customers = await prisma.pitchCustomer.findMany();
    const users = await prisma.user.findMany({ 
      where: { preferences: { role: UserRole.USER } } 
    });
    await seedBookings(pitches, grounds, customers, users);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
