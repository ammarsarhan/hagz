import prisma from "@/shared/lib/utils/prisma.js";
import { seedLedger } from "@/../prisma/seeds/ledger.js";
import { BookingStatus } from "@/generated/prisma/enums.js";

async function run() {
  try {
    const pitches = await prisma.pitch.findMany();
    const bookings = await prisma.booking.findMany({
      where: { status: BookingStatus.COMPLETED }
    });
    await seedLedger(pitches, bookings);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
