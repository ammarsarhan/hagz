import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";
import { LedgerAction, PitchTier, BookingStatus, BookingChannel, PayoutMethod, PayoutStatus, PayoutTrigger } from "@/generated/prisma/enums.js";

const platformRates = {
  [PitchTier.ALPHA]: 0.05,
  [PitchTier.BETA]: 0.075,
  [PitchTier.STANDARD]: 0.10,
  [PitchTier.PREMIUM]: 0.15,
};

export async function seedLedger(pitches: any[], bookings: any[]) {
  console.log("Seeding ledger entries and payouts...");

  for (const pitch of pitches) {
    const pitchLedger = await prisma.pitchLedger.findUnique({ where: { pitchId: pitch.id } });
    if (!pitchLedger) continue;

    const pitchBookings = bookings.filter(b => b.pitchId === pitch.id && b.status === BookingStatus.COMPLETED);
    const rate = platformRates[pitch.tier as PitchTier] || 0.10;

    let balance = 0;

    for (const booking of pitchBookings) {
      // 1. Booking Revenue (Owner's share)
      // For this seed, we consider the baseAmount as the revenue.
      // totalAmount includes service fee which goes to platform.
      const snapshot = booking.pricingSnapshot as any;
      const baseAmount = snapshot.slots.reduce((sum: number, s: any) => sum + s.price, 0);

      await prisma.ledgerEntry.create({
        data: {
          ledgerId: pitchLedger.id,
          bookingId: booking.id,
          type: LedgerAction.BOOKING_REVENUE,
          amount: baseAmount,
          note: `Revenue from booking #${booking.id.slice(-6)}`
        }
      });
      balance += baseAmount;

      // 2. Platform Fee Debit
      const platformFee = Math.round(baseAmount * rate);
      await prisma.ledgerEntry.create({
        data: {
          ledgerId: pitchLedger.id,
          bookingId: booking.id,
          type: LedgerAction.PLATFORM_FEE_DEBIT,
          amount: -platformFee,
          note: `Platform fee (${rate * 100}%) for booking #${booking.id.slice(-6)}`
        }
      });
      balance -= platformFee;

      // 3. Cash Fee Debt (if WALK_IN)
      if (booking.channel === BookingChannel.WALK_IN) {
        await prisma.ledgerEntry.create({
          data: {
            ledgerId: pitchLedger.id,
            bookingId: booking.id,
            type: LedgerAction.CASH_FEE_DEBT,
            amount: -platformFee,
            note: `Fee debt for cash booking #${booking.id.slice(-6)}`
          }
        });
        // This doesn't double-deduct from balance in real logic usually, 
        // but it tracks what the owner owes from cash.
      }
    }

    // Update balance
    await prisma.pitchLedger.update({
      where: { id: pitchLedger.id },
      data: { balance }
    });

    // 4. Create Payout Destination
    const staffOwner = await prisma.staff.findFirst({
      where: { pitchId: pitch.id, role: "OWNER" }
    });
    
    if (staffOwner) {
      const destination = await prisma.payoutDestination.create({
        data: {
          userId: staffOwner.userId,
          method: PayoutMethod.BANK_TRANSFER,
          accountName: faker.person.fullName(),
          accountRef: faker.finance.iban(),
          isDefault: true
        }
      });

      // 5. Create Payouts
      if (balance > 1000) {
        const completedAmount = Math.round(balance * 0.7);
        const payoutCompleted = await prisma.payout.create({
          data: {
            ledgerId: pitchLedger.id,
            destinationId: destination.id,
            amount: completedAmount,
            method: PayoutMethod.BANK_TRANSFER,
            trigger: PayoutTrigger.MANUAL,
            status: PayoutStatus.COMPLETED,
            processedAt: new Date(),
            transactionRef: faker.finance.transactionDescription()
          }
        });

        // Deduct from ledger
        await prisma.ledgerEntry.create({
          data: {
            ledgerId: pitchLedger.id,
            payoutId: payoutCompleted.id,
            type: LedgerAction.PAYOUT,
            amount: -completedAmount,
            note: "Monthly payout"
          }
        });

        const pendingAmount = Math.round((balance - completedAmount) * 0.5);
        if (pendingAmount > 0) {
          await prisma.payout.create({
            data: {
              ledgerId: pitchLedger.id,
              destinationId: destination.id,
              amount: pendingAmount,
              method: PayoutMethod.BANK_TRANSFER,
              trigger: PayoutTrigger.SCHEDULED,
              status: PayoutStatus.PENDING
            }
          });
        }

        // Final balance update
        await prisma.pitchLedger.update({
          where: { id: pitchLedger.id },
          data: { balance: balance - completedAmount }
        });
      }
    }
  }

  console.log("Successfully seeded ledger and payouts.");
}
