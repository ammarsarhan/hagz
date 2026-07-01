import prisma from "@/shared/lib/utils/prisma.js";
import { seedLocations } from "./seeds/locations.js";
import { seedUsers } from "./seeds/users.js";
import { seedPitches } from "./seeds/pitches.js";
import { seedGrounds } from "./seeds/grounds.js";
import { seedStaff } from "./seeds/staff.js";
import { seedCustomers } from "./seeds/customers.js";
import { seedBookings } from "./seeds/bookings.js";
import { seedLedger } from "./seeds/ledger.js";
import { seedReviews } from "./seeds/reviews.js";
import { seedFavorites } from "./seeds/favorites.js";
import { seedInvitations } from "./seeds/invitations.js";

async function main() {
  const exists = await prisma.pitch.count();
  if (exists > 0) {
    console.log("Database already seeded (found existing pitches). Skipping seed...");
    return;
  }

  console.log("Starting full platform seed...");

  // 1. Locations (Governorates + Areas)
  await seedLocations();

  // 2. Users (50 regular, 30 owners, 60 managers)
  const { users, owners, managers } = await seedUsers();

  // 3. Pitches (30 total)
  const { pitches } = await seedPitches();

  // 4. Grounds (per pitch, with settings and schedules)
  const { grounds } = await seedGrounds(pitches);

  // 5. Staff (Owner per pitch, 2 Managers per pitch)
  const { staff } = await seedStaff(pitches, owners, managers);

  // 5.5 Invitations (Accepted for existing managers, plus random pending/expired/rejected)
  const { invitations } = await seedInvitations(pitches, staff, managers);

  // 6. Customers (15-30 per pitch)
  const { customers } = await seedCustomers(pitches, users);

  // 7. Bookings (historical, recent, upcoming)
  const { bookings } = await seedBookings(pitches, grounds, customers, users);

  // 8. Ledger (entries and payouts)
  await seedLedger(pitches, bookings);

  // 9. Reviews (randomly assigned to pitches from users)
  const { reviews } = await seedReviews(pitches, users);

  // 10. Favorites (randomly assigned to pitches from users)
  const { favorites } = await seedFavorites(pitches, users);

  console.log(`
Seed Summary:
--------------
Users:     ${users.length + owners.length}
Pitches:   ${pitches.length}
Grounds:   ${grounds.length}
Staff:     ${staff.length}
Customers: ${customers.length}
Bookings:  ${bookings.length}
Reviews:   ${reviews.length}
Favorites: ${favorites.length}
Invites:   ${invitations.length}
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
