import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { StaffRole, PermissionLevel } from "@/generated/prisma/enums.js";

export async function seedStaff(pitches: any[], owners: any[], managers: any[]) {
  console.log("Seeding staff...");

  const allStaff = [];

  const ownerPermissions = {
    settings: PermissionLevel.WRITE,
    schedule: PermissionLevel.WRITE,
    bookings: PermissionLevel.WRITE,
    analytics: PermissionLevel.WRITE,
    payments: PermissionLevel.WRITE,
    layout: PermissionLevel.WRITE,
    team: PermissionLevel.WRITE,
    properties: PermissionLevel.WRITE
  };

  const managerPermissions = {
    settings: PermissionLevel.READ,
    schedule: PermissionLevel.WRITE,
    bookings: PermissionLevel.WRITE,
    analytics: PermissionLevel.READ,
    payments: PermissionLevel.NONE,
    layout: PermissionLevel.READ,
    team: PermissionLevel.NONE,
    properties: PermissionLevel.READ
  };

  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const owner = owners[i % owners.length];

    // Create Owner
    const staffOwner = await prisma.staff.create({
      data: {
        userId: owner.id,
        pitchId: pitch.id,
        role: StaffRole.OWNER,
        permissions: ownerPermissions
      }
    });

    allStaff.push(staffOwner);

    // Assign exactly 2 managers
    const pitchManagers = [managers[i * 2], managers[i * 2 + 1]];

    for (const managerUser of pitchManagers) {
      if (managerUser && managerUser.id !== owner.id) {
        const staffManager = await prisma.staff.upsert({
          where: {
            userId_pitchId: {
              userId: managerUser.id,
              pitchId: pitch.id
            }
          },
          update: {},
          create: {
            userId: managerUser.id,
            pitchId: pitch.id,
            role: StaffRole.MANAGER,
            permissions: managerPermissions
          }
        });
        
        allStaff.push(staffManager);
      }
    }
  }

  console.log(`Successfully seeded ${allStaff.length} staff members.`);
  return { staff: allStaff };
}
