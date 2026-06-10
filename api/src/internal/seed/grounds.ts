import prisma from "@/shared/lib/utils/prisma.js";
import { seedGrounds } from "@/../prisma/seeds/grounds.js";

async function run() {
  try {
    const pitches = await prisma.pitch.findMany();
    await seedGrounds(pitches);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
