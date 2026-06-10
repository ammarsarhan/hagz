import prisma from "@/shared/lib/utils/prisma.js";
import { seedLocations } from "./seeds/locations.js";
import { seedUsers } from "./seeds/users.js";
import { seedPitches } from "./seeds/pitches.js";
import { seedGrounds } from "./seeds/grounds.js";
import { seedStaff } from "./seeds/staff.js";
import { seedCustomers } from "./seeds/customers.js";
import { seedBookings } from "./seeds/bookings.js";
import { seedLedger } from "./seeds/ledger.js";

async function main() {
  const exists = await prisma.pitch.count();
  if (exists > 0) {
    console.log("Database already seeded (found existing pitches). Skipping seed...");
    return;
  }

  console.log("Starting full platform seed...");

  // 1. Locations (Governorates + Areas)
  await seedLocations();

  // 2. Users (50 regular + 30 owners)
  const { users, owners } = await seedUsers();

  // 3. Pitches (30 total)
  const { pitches } = await seedPitches();

  // 4. Grounds (per pitch, with settings and schedules)
  const { grounds } = await seedGrounds(pitches);

  // 5. Staff (Owner per pitch, Manager on ~40%)
  const { staff } = await seedStaff(pitches, owners, users);

  // 6. Customers (15-30 per pitch)
  const { customers } = await seedCustomers(pitches, users);

  // 7. Bookings (historical, recent, upcoming)
  const { bookings } = await seedBookings(pitches, grounds, customers, users);

  // 8. Ledger (entries and payouts)
  await seedLedger(pitches, bookings);

  console.log(`
Seed Summary:
--------------
Users:     ${users.length + owners.length}
Pitches:   ${pitches.length}
Grounds:   ${grounds.length}
Staff:     ${staff.length}
Customers: ${customers.length}
Bookings:  ${bookings.length}
--------------
Seed completed successfully! Mabrook!
  `);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
