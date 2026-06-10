import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { BookingActor, BookingChannel, BookingStatus, GroundSize, PaymentMethod, PitchTier, PriceType, SlotStatus } from "@/generated/prisma/enums.js";
import { addHours, subDays, subHours, isPast, isFuture } from "date-fns";
import config from "@/shared/config.js";

const SERVICE_RATE = config.SERVICE_RATE || 1.5;

function getGroundSizeMultiplier(size: GroundSize) {
  switch (size) {
    case GroundSize.FIVE_A_SIDE: return 10;
    case GroundSize.SEVEN_A_SIDE: return 14;
    case GroundSize.ELEVEN_A_SIDE: return 22;
    default: return 10;
  }
}

export async function seedBookings(pitches: any[], grounds: any[], customers: any[], users: any[]) {
  console.log("Seeding bookings, payments, and events...");

  const allBookings = [];

  for (const pitch of pitches) {
    let bookingTarget = 40;
    if (pitch.tier === PitchTier.STANDARD) bookingTarget = 15;
    
    const pitchGrounds = grounds.filter(g => g.pitchId === pitch.id);
    const pitchCustomers = customers.filter(c => c.pitchId === pitch.id);

    for (let i = 0; i < bookingTarget; i++) {
      const ground = faker.helpers.arrayElement(pitchGrounds);
      const customer = faker.helpers.arrayElement(pitchCustomers);
      const initiator = customer.userId ? users.find(u => u.id === customer.userId) : faker.helpers.arrayElement(users);

      // 1. Determine Timeline and Status
      const randTimeline = Math.random();
      let startTime: Date;
      let status: BookingStatus;

      if (randTimeline < 0.85) { // Historical (last 60 days)
        startTime = faker.date.between({ from: subDays(new Date(), 60), to: subHours(new Date(), 24) });
        startTime.setMinutes(0, 0, 0);
        
        const randStatus = Math.random();
        if (randStatus < 0.75) status = BookingStatus.COMPLETED;
        else if (randStatus < 0.90) status = BookingStatus.CANCELLED;
        else status = BookingStatus.NO_SHOW;
      } else if (randTimeline < 0.95) { // Recent (last 24h)
        startTime = faker.date.between({ from: subHours(new Date(), 24), to: new Date() });
        startTime.setMinutes(0, 0, 0);
        status = faker.helpers.arrayElement([BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]);
      } else { // Upcoming (next 72h)
        startTime = faker.date.between({ from: new Date(), to: addHours(new Date(), 72) });
        startTime.setMinutes(0, 0, 0);
        status = Math.random() < 0.2 ? BookingStatus.RESERVED : BookingStatus.CONFIRMED;
      }

      // 2. Channel and Payment Method
      const channel = Math.random() < 0.75 ? BookingChannel.ONLINE : BookingChannel.WALK_IN;
      const paymentMethod = channel === BookingChannel.WALK_IN ? PaymentMethod.CASH : faker.helpers.arrayElement([PaymentMethod.CARD, PaymentMethod.WALLET]);

      // 3. Find available slots
      const duration = faker.helpers.arrayElement([1, 2]);
      const endTime = addHours(startTime, duration);
      
      const slots = await prisma.groundSlot.findMany({
        where: {
          groundId: ground.id,
          startsAt: { gte: startTime, lt: endTime },
          status: SlotStatus.AVAILABLE
        },
        orderBy: { startsAt: "asc" }
      });

      if (slots.length < duration) continue; // Skip if slots taken

      // 4. Calculate pricing
      const pricingMap = {
        BASE: ground.basePrice,
        PEAK: ground.peakPrice ?? ground.basePrice,
        DISCOUNT: ground.discountPrice ?? ground.basePrice
      };

      const pricingSnapshot = {
        basePrice: ground.basePrice,
        peakPrice: ground.peakPrice,
        discountPrice: ground.discountPrice,
        allowDeposit: pitch.tier === PitchTier.PREMIUM,
        depositPercentage: pitch.tier === PitchTier.PREMIUM ? 25 : null,
        slots: slots.map(slot => ({
          startsAt: slot.startsAt,
          priceType: slot.priceType,
          price: pricingMap[slot.priceType as keyof typeof pricingMap]
        }))
      };

      let baseAmount = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType as keyof typeof pricingMap], 0);
      let totalAmount = baseAmount;
      
      if (channel === BookingChannel.ONLINE) {
        totalAmount += slots.length * getGroundSizeMultiplier(ground.size) * SERVICE_RATE;
      }

      let depositFee = null;
      if (channel === BookingChannel.ONLINE && pricingSnapshot.allowDeposit) {
        depositFee = Math.round(totalAmount * (pricingSnapshot.depositPercentage! / 100));
      }

      // 5. Create Booking
      const booking = await prisma.booking.create({
        data: {
          pitchId: pitch.id,
          groundId: ground.id,
          customerId: customer.id,
          initiatorId: initiator.id,
          bookerRole: channel === BookingChannel.ONLINE ? BookingActor.USER : BookingActor.STAFF,
          isApproved: true,
          startTime,
          endTime,
          channel,
          pricingSnapshot,
          totalAmount: Math.round(totalAmount),
          depositFee,
          paymentMethod,
          status,
          payment: {
            create: {
              method: paymentMethod,
              totalAmount: Math.round(totalAmount),
              depositFee,
            }
          }
        }
      });

      // 6. Link slots
      await prisma.groundSlot.updateMany({
        where: { id: { in: slots.map(s => s.id) } },
        data: { status: SlotStatus.BOOKED, bookingId: booking.id }
      });

      // 7. Create Events
      const events: { previousStatus: BookingStatus; updatedStatus: BookingStatus; logs: string }[] = [
        { previousStatus: BookingStatus.RESERVED, updatedStatus: BookingStatus.RESERVED, logs: "Booking initialized." }
      ];

      if (status !== BookingStatus.RESERVED) {
        events.push({ previousStatus: BookingStatus.RESERVED, updatedStatus: BookingStatus.CONFIRMED, logs: "Booking confirmed." });
      }
      if (status === BookingStatus.IN_PROGRESS || status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        events.push({ previousStatus: BookingStatus.CONFIRMED, updatedStatus: BookingStatus.IN_PROGRESS, logs: "Booking started." });
      }
      if (status === BookingStatus.COMPLETED) {
        events.push({ previousStatus: BookingStatus.IN_PROGRESS, updatedStatus: BookingStatus.COMPLETED, logs: "Booking completed." });
      }
      if (status === BookingStatus.NO_SHOW) {
        events.push({ previousStatus: BookingStatus.IN_PROGRESS, updatedStatus: BookingStatus.NO_SHOW, logs: "Customer did not show up." });
      }
      if (status === BookingStatus.CANCELLED) {
        events.push({ previousStatus: BookingStatus.CONFIRMED, updatedStatus: BookingStatus.CANCELLED, logs: "Booking cancelled by customer." });
      }

      await prisma.bookingEvent.createMany({
        data: events.map(e => ({ ...e, bookingId: booking.id }))
      });

      allBookings.push(booking);
    }
  }

  console.log(`Successfully seeded ${allBookings.length} bookings.`);
  return { bookings: allBookings };
}
