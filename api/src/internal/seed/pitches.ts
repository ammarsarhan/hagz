import prisma from "@/shared/lib/utils/prisma.js";
import { seedPitches } from "@/../prisma/seeds/pitches.js";

async function run() {
  try {
    await seedPitches();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
