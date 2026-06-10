import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { GroundSport, GroundSurface, GroundSize, GroundStatus, PaymentMethod, PitchTier, PriceType, SlotStatus, ScheduleStatus } from "@/generated/prisma/enums.js";
import { addDays, setHours, startOfDay, subDays } from "date-fns";
import PitchService from "@/domains/pitches/services/pitches.service.js";

function buildBitmask(hours: number[]) {
  let mask = 0;
  for (const h of hours) {
    mask |= (1 << h);
  }
  const buffer = Buffer.alloc(3);
  buffer.writeUIntBE(mask & 0xffffff, 0, 3);
  return buffer;
}

export async function seedGrounds(pitches: any[]) {
  console.log("Seeding grounds, settings, and schedules...");

  const allGrounds = [];
  const pitchService = new PitchService();

  const peakHours = [17, 18, 19, 20, 21];
  const discountHours = [8, 9, 10];
  const baseHours = [11, 12, 13, 14, 15, 16];
  
  const peakMask = buildBitmask(peakHours);
  const discountMask = buildBitmask(discountHours);
  const baseMask = buildBitmask(baseHours);

  for (const pitch of pitches) {
    const groundCount = faker.number.int({ min: 1, max: 2 });
    const pitchGrounds = [];

    for (let i = 0; i < groundCount; i++) {
      let basePrice, peakPrice, discountPrice;

      if (pitch.tier === PitchTier.ALPHA) {
        basePrice = 200; peakPrice = 250; discountPrice = 150;
      } else if (pitch.tier === PitchTier.STANDARD) {
        basePrice = 400; peakPrice = 500; discountPrice = 300;
      } else {
        basePrice = 700; peakPrice = 900; discountPrice = 500;
      }

      const ground = await prisma.ground.create({
        data: {
          pitchId: pitch.id,
          name: `${pitch.name} - Ground ${i + 1}`,
          sport: GroundSport.FOOTBALL,
          surface: GroundSurface.ARTIFICIAL_TURF,
          size: faker.helpers.arrayElement([GroundSize.FIVE_A_SIDE, GroundSize.SEVEN_A_SIDE]),
          status: GroundStatus.ACTIVE,
          basePrice,
          peakPrice,
          discountPrice,
          settings: {
            create: {
              autoConfirm: pitch.tier !== PitchTier.PREMIUM,
              allowDeposit: pitch.tier === PitchTier.PREMIUM,
              depositPercentage: pitch.tier === PitchTier.PREMIUM ? 25 : null,
              paymentMethods: [PaymentMethod.CASH, PaymentMethod.CARD],
            }
          },
          schedule: {
            createMany: {
              data: Array.from({ length: 7 }).map((_, day) => ({
                dayOfWeek: day + 1,
                baseHours: baseMask,
                peakHours: peakMask,
                discountHours: discountMask,
                isActive: true,
                status: ScheduleStatus.PENDING
              }))
            }
          }
        }
      });

      // Generate slots for historical (60 days) + recent (24h) + upcoming (3 days)
      const startDate = startOfDay(subDays(new Date(), 60));
      const endDate = startOfDay(addDays(new Date(), 4));
      
      const slotsData = [];
      for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
        // Peak slots
        for (const h of peakHours) {
          slotsData.push({
            pitchId: pitch.id,
            groundId: ground.id,
            startsAt: setHours(d, h),
            priceType: PriceType.PEAK,
            status: SlotStatus.AVAILABLE,
          });
        }
        // Discount slots
        for (const h of discountHours) {
          slotsData.push({
            pitchId: pitch.id,
            groundId: ground.id,
            startsAt: setHours(d, h),
            priceType: PriceType.DISCOUNT,
            status: SlotStatus.AVAILABLE,
          });
        }
        // Base slots
        for (const h of baseHours) {
          slotsData.push({
            pitchId: pitch.id,
            groundId: ground.id,
            startsAt: setHours(d, h),
            priceType: PriceType.BASE,
            status: SlotStatus.AVAILABLE,
          });
        }
      }

      await prisma.groundSlot.createMany({ data: slotsData });
      
      pitchGrounds.push(ground);
      allGrounds.push(ground);
    }

    // Update denormalized fields on Pitch
    const prices = pitchGrounds.flatMap(g => [g.basePrice, g.peakPrice, g.discountPrice].filter(p => p != null));
    await prisma.pitch.update({
      where: { id: pitch.id },
      data: {
        sports: [...new Set(pitchGrounds.map(g => g.sport))],
        sizes: [...new Set(pitchGrounds.map(g => g.size))],
        minimumPrice: Math.min(...prices),
        maximumPrice: Math.max(...prices),
      }
    });

    // Follow the flow: Approve then Publish
    await PitchService.approvePitch(pitch.id);
    await pitchService.publishPitch(pitch.id);
  }

  console.log(`Successfully seeded ${allGrounds.length} grounds.`);
  return { grounds: allGrounds };
}
