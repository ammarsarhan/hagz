import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { InvitationStatus, StaffRole } from "@/generated/prisma/enums.js";
import { addDays, subDays } from "date-fns";
import StaffService from "@/domains/pitches/services/staff.service.js";

export async function seedInvitations(pitches: any[], staff: any[], managers: any[]) {
  console.log("Seeding invitations...");

  const invitations = [];

  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];

    // Find the owner of this pitch to act as the creator of the invitations
    const pitchOwner = staff.find(s => s.pitchId === pitch.id && s.role === StaffRole.OWNER);
    if (!pitchOwner) continue;

    // Find the managers assigned to this pitch
    const pitchManagersStaff = staff.filter(s => s.pitchId === pitch.id && s.role === StaffRole.MANAGER);

    // 1. Create ACCEPTED invitations for the existing managers
    for (const managerStaff of pitchManagersStaff) {
      const managerUser = managers.find(m => m.id === managerStaff.userId);
      if (managerUser) {
        const invitation = await prisma.invitation.upsert({
          where: {
            pitchId_phone_status: {
              pitchId: pitch.id,
              phone: managerUser.phone,
              status: InvitationStatus.ACCEPTED
            }
          },
          update: {},
          create: {
            pitchId: pitch.id,
            name: `${managerUser.firstName} ${managerUser.lastName}`,
            phone: managerUser.phone,
            token: faker.string.alphanumeric(64),
            status: InvitationStatus.ACCEPTED,
            expiresAt: addDays(new Date(), faker.number.int({ min: 1, max: 7 })),
            acceptedAt: subDays(new Date(), faker.number.int({ min: 1, max: 30 })),
            creatorId: pitchOwner.userId,
            createdAt: subDays(new Date(), faker.number.int({ min: 31, max: 60 }))
          }
        });

        invitations.push(invitation);
        await StaffService.dequeueInvitationExpiry(invitation.id);
      }
    }

    // 2. Create some random PENDING invitations
    for (let j = 0; j < 2; j++) {
      const phone = faker.helpers.fromRegExp(/\+201[0125][0-9]{8}/);
      const invitation = await prisma.invitation.create({
        data: {
          pitchId: pitch.id,
          name: faker.person.fullName(),
          phone,
          token: faker.string.alphanumeric(64),
          status: InvitationStatus.PENDING,
          expiresAt: addDays(new Date(), faker.number.int({ min: 1, max: 7 })),
          creatorId: pitchOwner.userId,
          createdAt: subDays(new Date(), faker.number.int({ min: 0, max: 3 }))
        }
      });

      invitations.push(invitation);
      await StaffService.enqueueInvitationExpiry(invitation.id, invitation.pitchId, invitation.expiresAt);
    }

    // 3. Create some REJECTED invitations
    for (let j = 0; j < 1; j++) {
      const phone = faker.helpers.fromRegExp(/\+201[0125][0-9]{8}/);
      const invitation = await prisma.invitation.create({
        data: {
          pitchId: pitch.id,
          name: faker.person.fullName(),
          phone,
          token: faker.string.alphanumeric(64),
          status: InvitationStatus.REJECTED,
          expiresAt: addDays(new Date(), faker.number.int({ min: 1, max: 7 })),
          rejectedAt: subDays(new Date(), faker.number.int({ min: 1, max: 10 })),
          creatorId: pitchOwner.userId,
          createdAt: subDays(new Date(), faker.number.int({ min: 11, max: 20 }))
        }
      });

      invitations.push(invitation);
      await StaffService.dequeueInvitationExpiry(invitation.id);
    }

    // 4. Create some EXPIRED invitations
    for (let j = 0; j < 1; j++) {
      const phone = faker.helpers.fromRegExp(/\+201[0125][0-9]{8}/);
      const invitation = await prisma.invitation.create({
        data: {
          pitchId: pitch.id,
          name: faker.person.fullName(),
          phone,
          token: faker.string.alphanumeric(64),
          status: InvitationStatus.EXPIRED,
          expiresAt: subDays(new Date(), faker.number.int({ min: 1, max: 5 })),
          creatorId: pitchOwner.userId,
          createdAt: subDays(new Date(), faker.number.int({ min: 10, max: 20 }))
        }
      });

      invitations.push(invitation);
      await StaffService.dequeueInvitationExpiry(invitation.id);
    }

    // 5. Create some DELETED (revoked) invitations
    for (let j = 0; j < 1; j++) {
      const phone = faker.helpers.fromRegExp(/\+201[0125][0-9]{8}/);
      const invitation = await prisma.invitation.create({
        data: {
          pitchId: pitch.id,
          name: faker.person.fullName(),
          phone,
          token: faker.string.alphanumeric(64),
          status: InvitationStatus.DELETED,
          expiresAt: addDays(new Date(), faker.number.int({ min: 1, max: 7 })),
          creatorId: pitchOwner.userId,
          createdAt: subDays(new Date(), faker.number.int({ min: 1, max: 5 }))
        }
      });

      invitations.push(invitation);
      await StaffService.dequeueInvitationExpiry(invitation.id);
    }
  }

  console.log(`Successfully seeded ${invitations.length} invitations.`);
  return { invitations };
}
