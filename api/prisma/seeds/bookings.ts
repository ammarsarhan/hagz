import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { BookingChannel, BookingStatus, GroundSize, LedgerAction, PaymentMethod, PitchTier, PriceType, SlotStatus, UserRole } from "@/generated/prisma/enums.js";
import { addHours, subDays, subHours, differenceInHours } from "date-fns";
import config from "@/shared/config.js";
import BookingService from "@/domains/bookings/bookings.service.js";

const SERVICE_RATE = config.SERVICE_RATE;
const PLATFORM_FEE_RATE = config.PLATFORM_FEE_RATE;

function getGroundSizeMultiplier(size: GroundSize) {
  switch (size) {
    case GroundSize.FIVE_A_SIDE: return 10;
    case GroundSize.SEVEN_A_SIDE: return 14;
    case GroundSize.ELEVEN_A_SIDE: return 22;
    default: return 10;
  }
}

function resolveChannelAndMode(): { channel: BookingChannel; mode: "checkout" | "direct" } {
  const channel = faker.helpers.weightedArrayElement([
    { weight: 60, value: BookingChannel.ONLINE },
    { weight: 12, value: BookingChannel.WALK_IN },
    { weight: 14, value: BookingChannel.WHATSAPP },
    { weight: 10, value: BookingChannel.PHONE },
    { weight: 4, value: BookingChannel.OTHER },
  ]);

  if (channel === BookingChannel.ONLINE) return { channel, mode: "checkout" };
  if (channel === BookingChannel.WALK_IN) return { channel, mode: "direct" };

  return { channel, mode: faker.helpers.arrayElement(["checkout", "direct"]) };
}

function resolvePaymentMethod(mode: "checkout" | "direct"): PaymentMethod {
  return mode === "checkout"
    ? faker.helpers.arrayElement([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.WALLET])
    : faker.helpers.arrayElement([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.WALLET]);
}

export async function seedBookings(pitches: any[], grounds: any[], customers: any[], users: any[]) {
  console.log("Seeding bookings, payments, ledger entries, and events...");

  const allBookings = [];
  const ledgerCache = new Map<string, string>(); // pitchId -> ledgerId

  async function resolveLedgerId(pitchId: string): Promise<string> {
    if (ledgerCache.has(pitchId)) return ledgerCache.get(pitchId)!;

    const ledger = await prisma.pitchLedger.upsert({
      where: { pitchId },
      create: { pitchId, balance: 0 },
      update: {},
    });

    ledgerCache.set(pitchId, ledger.id);
    return ledger.id;
  }

  for (const pitch of pitches) {
    let bookingTarget = 40;
    if (pitch.tier === PitchTier.STANDARD) bookingTarget = 15;

    const pitchGrounds = grounds.filter(g => g.pitchId === pitch.id);
    const pitchCustomers = customers.filter(c => c.pitchId === pitch.id);

    for (let i = 0; i < bookingTarget; i++) {
      const ground = faker.helpers.arrayElement(pitchGrounds);
      const customer = faker.helpers.arrayElement(pitchCustomers);
      const initiator = customer.userId ? users.find(u => u.id === customer.userId) : faker.helpers.arrayElement(users);

      const settings = await prisma.groundSettings.findUnique({ where: { groundId: ground.id } });
      if (!settings) continue;

      // 1. Determine timeline and status.
      const timeline = Math.random();
      let startTime: Date;
      let status: BookingStatus;

      if (timeline < 0.85) {
        startTime = faker.date.between({ from: subDays(new Date(), 60), to: subHours(new Date(), 24) });
        startTime.setMinutes(0, 0, 0);

        const random = Math.random();
        if (random < 0.75) status = BookingStatus.COMPLETED;
        else if (random < 0.90) status = BookingStatus.CANCELLED;
        else status = BookingStatus.NO_SHOW;
      }
      else if (timeline < 0.95) {
        startTime = faker.date.between({ from: subHours(new Date(), 24), to: new Date() });
        startTime.setMinutes(0, 0, 0);
        status = faker.helpers.arrayElement([BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]);
      }
      else {
        startTime = faker.date.between({ from: new Date(), to: addHours(new Date(), 72) });
        startTime.setMinutes(0, 0, 0);
        status = Math.random() < 0.2 ? BookingStatus.RESERVED : BookingStatus.CONFIRMED;
      }

      // 2. Channel, mode, and payment method.
      const { channel, mode } = resolveChannelAndMode();
      const paymentMethod = resolvePaymentMethod(mode);

      // 3. Find available slots.
      const duration = faker.helpers.arrayElement([settings.minimumDuration, settings.maximumDuration].filter(Boolean) as number[]);
      const endTime = addHours(startTime, duration);

      // Constraint: checkout-mode bookings need enough lead time for payment; both modes respect maximumWindow.
      if (mode === "checkout" && differenceInHours(startTime, new Date()) < settings.minimumWindow) continue;
      if (differenceInHours(startTime, new Date()) > settings.maximumWindow) continue;

      const slots = await prisma.groundSlot.findMany({
        where: {
          groundId: ground.id,
          startsAt: { gte: startTime, lt: endTime },
          status: SlotStatus.AVAILABLE
        },
        orderBy: { startsAt: "asc" }
      });

      if (slots.length < duration) continue;

      // 4. Calculate pricing using BookingService.
      const { pricingSnapshot } = BookingService.buildPricingSnapshot(ground, settings, slots);

      let baseAmount = slots.reduce((sum, slot) => sum + (pricingSnapshot.slots.find(s => s.startsAt.getTime() === slot.startsAt.getTime())?.price || 0), 0);
      let totalAmount = baseAmount;

      // Service fee and deposit are gated on mode now, not on channel === ONLINE.
      if (mode === "checkout") {
        totalAmount += slots.length * getGroundSizeMultiplier(ground.size) * SERVICE_RATE;
      }

      let depositFee = null;
      if (mode === "checkout" && pricingSnapshot.allowDeposit) {
        depositFee = Math.round(totalAmount * (pricingSnapshot.depositPercentage! / 100));
      }

      totalAmount = Math.round(totalAmount);

      // 5. Create booking + payment.
      const booking = await prisma.booking.create({
        data: {
          pitchId: pitch.id,
          groundId: ground.id,
          customerId: customer.id,
          initiatorId: initiator.id,
          bookerRole: channel === BookingChannel.ONLINE ? UserRole.USER : faker.helpers.arrayElement([UserRole.MANAGER, UserRole.OWNER]),
          isApproved: true,
          startTime,
          endTime,
          channel,
          pricingSnapshot,
          totalAmount,
          depositFee,
          paymentMethod,
          status,
          payment: {
            create: {
              method: paymentMethod,
              totalAmount,
              depositFee,
            }
          }
        }
      });

      // 6. Link slots.
      await prisma.groundSlot.updateMany({
        where: { id: { in: slots.map(s => s.id) } },
        data: { status: SlotStatus.BOOKED, bookingId: booking.id }
      });

      // 7. Direct-mode ledger entries — mirrors what PaymentService writes at creation
      // for staff-settled bookings. Checkout-mode revenue/fee entries are left to the
      // completion worker, same as before, so they're not simulated here.
      if (mode === "direct") {
        const ledgerId = await resolveLedgerId(pitch.id);

      if (paymentMethod === PaymentMethod.CASH) {
        const platformFee = Math.round(totalAmount * PLATFORM_FEE_RATE);

        await prisma.ledgerEntry.create({
          data: { ledgerId, bookingId: booking.id, type: LedgerAction.BOOKING_REVENUE, amount: baseAmount, note: "Owner's share of booking total." }
        });

        await prisma.ledgerEntry.create({
          data: { ledgerId, bookingId: booking.id, type: LedgerAction.PLATFORM_FEE_DEBIT, amount: -platformFee, note: "Platform commission, settled at payment time." }
        });

        await prisma.pitchLedger.update({
          where: { id: ledgerId },
          data: { balance: { increment: baseAmount - platformFee } }
        });
      } else {
          await prisma.ledgerEntry.create({
            data: {
              ledgerId,
              bookingId: booking.id,
              type: LedgerAction.EXTERNAL_PAYMENT_LOG,
              amount: 0,
              note: faker.helpers.maybe(() => "Paid via venue POS terminal.", { probability: 0.5 }) ?? null,
            }
          });
        }
      }

      // 8. Enqueue lifecycle.
      await BookingService.enqueueBookingLifecycle(booking, settings);

      // 9. Create events (historical events only).
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
};
