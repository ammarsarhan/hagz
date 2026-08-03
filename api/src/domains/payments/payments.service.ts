import { LedgerAction } from "@/generated/prisma/enums.js";
import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import config from "@/shared/config.js";

export default class PaymentService {
    // Todo: Initiate the actual intention process on Paymob.
    createIntention = async () => {
        return {
            clientSecret: "some-random-client-secret",
            transactionRef: "some-random-transaction-ref"
        };
    }

    // Todo: Create the actual webhook response handler with Paymob.
    
    private static readonly ensureLedger = async (tx: TransactionClient, pitchId: string) => {
        const existing = await tx.pitchLedger.findUnique({ where: { pitchId } });
        if (existing) return existing;

        return tx.pitchLedger.create({ data: { pitchId } });
    };

    static readonly createLedgerEntry = async (
        tx: TransactionClient,
        pitchId: string,
        entry: {
            type: LedgerAction;
            amount: number;
            bookingId?: string;
            payoutId?: string;
            note?: string;
        }
    ) => {
        const ledger = await PaymentService.ensureLedger(tx, pitchId);

        const created = await tx.ledgerEntry.create({
            data: {
                ledgerId: ledger.id,
                type: entry.type,
                amount: entry.amount,
                bookingId: entry.bookingId,
                payoutId: entry.payoutId,
                note: entry.note,
            }
        });

        await tx.pitchLedger.update({
            where: { id: ledger.id },
            data: { balance: { increment: entry.amount } }
        });

        return created;
    };

    static readonly reverseLedgerEntry = async (
        tx: TransactionClient,
        pitchId: string,
        entryId: string,
        reason: string
    ) => {
        const ledger = await PaymentService.ensureLedger(tx, pitchId);
        const original = await tx.ledgerEntry.findUnique({ where: { id: entryId } });

        if (!original)
            throw new NotFoundError("Could not find ledger entry with the specified ID.", ERROR_CODES.LEDGER_ENTRY_NOT_FOUND);

        if (original.ledgerId !== ledger.id)
            throw new BadRequestError("Ledger entry does not belong to the specified pitch.", ERROR_CODES.LEDGER_ENTRY_MISMATCH);

        return PaymentService.createLedgerEntry(tx, pitchId, {
            type: LedgerAction.ADJUSTMENT,
            amount: -original.amount,
            bookingId: original.bookingId ?? undefined,
            payoutId: original.payoutId ?? undefined,
            note: `Reversal of entry ${original.id}: ${reason}`,
        });
    };

    static readonly correctLedgerEntry = async (
        tx: TransactionClient,
        pitchId: string,
        entryId: string,
        correctedAmount: number,
        reason: string
    ) => {
        const original = await tx.ledgerEntry.findUniqueOrThrow({ where: { id: entryId } });
        const reversal = await PaymentService.reverseLedgerEntry(tx, pitchId, entryId, reason);

        const correction = await PaymentService.createLedgerEntry(tx, pitchId, {
            type: original.type,
            amount: correctedAmount,
            bookingId: original.bookingId ?? undefined,
            payoutId: original.payoutId ?? undefined,
            note: `Correction of entry ${original.id}: ${reason}`,
        });

        return { reversal, correction };
    };

    static readonly recordBookingRevenue = async (
        tx: TransactionClient,
        pitchId: string,
        bookingId: string,
        params: { baseAmount: number; serviceFee?: number; collectedViaPlatform: boolean }
    ) => {
        const commission = Math.round(params.baseAmount * config.PLATFORM_FEE_RATE);

        await PaymentService.createLedgerEntry(tx, pitchId, {
            type: LedgerAction.BOOKING_REVENUE,
            amount: params.baseAmount,
            bookingId,
            note: "Owner's share of booking total.",
        });

        await PaymentService.createLedgerEntry(tx, pitchId, {
            type: params.collectedViaPlatform ? LedgerAction.PLATFORM_FEE_DEBIT : LedgerAction.CASH_FEE_DEBT,
            amount: -commission,
            bookingId,
            note: params.collectedViaPlatform
                ? "Platform commission, netted from payout."
                : "Platform commission owed on a cash booking, not yet settled.",
        });

        if (params.serviceFee) {
            await PaymentService.createLedgerEntry(tx, pitchId, {
                type: LedgerAction.SERVICE_FEE_CREDIT,
                amount: 0,
                bookingId,
                note: `Service fee of ${params.serviceFee} collected from customer (platform revenue).`,
            });
        }
    };

    static readonly reverseBookingLedgerEntries = async (
        tx: TransactionClient,
        pitchId: string,
        bookingId: string,
        reason: string
    ) => {
        const ledger = await PaymentService.ensureLedger(tx, pitchId);
        const entries = await tx.ledgerEntry.findMany({ where: { ledgerId: ledger.id, bookingId } });

        for (const entry of entries) {
            await PaymentService.createLedgerEntry(tx, pitchId, {
                type: LedgerAction.ADJUSTMENT,
                amount: -entry.amount,
                bookingId,
                note: `Reversal (${reason}) of entry ${entry.id}.`,
            });
        }
    };
};
