import { LedgerAction, PayoutMethod, PayoutStatus, PayoutTrigger } from "@/generated/prisma/enums.js";
import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { BadRequestError, ConflictError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
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
        params: { baseAmount: number; serviceFee?: number; collectedViaPlatform?: boolean }
    ) => {
        const commission = Math.round(params.baseAmount * config.PLATFORM_FEE_RATE);

        await PaymentService.createLedgerEntry(tx, pitchId, {
            type: LedgerAction.BOOKING_REVENUE,
            amount: params.baseAmount,
            bookingId,
            note: "Owner's share of booking total.",
        });

        await PaymentService.createLedgerEntry(tx, pitchId, {
            type: LedgerAction.PLATFORM_FEE_DEBIT,
            amount: -commission,
            bookingId,
            note: "Platform commission, settled at payment time.",
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

    static readonly fetchPayouts = async (
        pitchId: string,
        query?: { status?: PayoutStatus; page?: number; limit?: number }
    ) => {
        const ledger = await prisma.pitchLedger.findUnique({ where: { pitchId } });
        if (!ledger) {
            return { payouts: [], balance: 0, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
        }

        const page = Math.max(1, query?.page ?? 1);
        const limit = Math.min(100, Math.max(1, query?.limit ?? 10));
        const skip = (page - 1) * limit;

        const where = {
            ledgerId: ledger.id,
            ...(query?.status ? { status: query.status } : {})
        };

        const [payouts, total] = await Promise.all([
            prisma.payout.findMany({
                where,
                orderBy: { requestedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.payout.count({ where }),
        ]);

        return {
            payouts,
            balance: ledger.balance,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    };

    static readonly createPayout = async (
        pitchId: string,
        payload: {
            amount: number;
            method: PayoutMethod;
            destination: string;
            trigger?: PayoutTrigger;
        }
    ) => {
        return prisma.$transaction(async (tx) => {
            const ledger = await PaymentService.ensureLedger(tx, pitchId);

            // Ensure always at most ONE payout in PENDING or PROCESSING status
            const activePayout = await tx.payout.findFirst({
                where: {
                    ledgerId: ledger.id,
                    status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] }
                }
            });

            if (activePayout) {
                throw new ConflictError(
                    "An active payout request is already pending or in progress for this pitch.",
                    ERROR_CODES.PAYOUT_ACTIVE_EXISTS
                );
            }

            if (payload.amount <= 0) {
                throw new BadRequestError(
                    "Payout amount must be greater than zero.",
                    ERROR_CODES.PAYOUT_INVALID_AMOUNT
                );
            }

            if (payload.amount > ledger.balance) {
                throw new BadRequestError(
                    `Insufficient balance (${ledger.balance}) for requested payout of ${payload.amount}.`,
                    ERROR_CODES.PAYOUT_INVALID_AMOUNT
                );
            }

            const payout = await tx.payout.create({
                data: {
                    ledgerId: ledger.id,
                    amount: payload.amount,
                    method: payload.method,
                    destination: payload.destination,
                    trigger: payload.trigger ?? PayoutTrigger.MANUAL,
                    status: PayoutStatus.PENDING,
                }
            });

            await PaymentService.createLedgerEntry(tx, pitchId, {
                type: LedgerAction.PAYOUT,
                amount: -payload.amount,
                payoutId: payout.id,
                note: `Payout requested via ${payload.method}`,
            });

            return payout;
        });
    };

    static readonly fetchLedgerEntries = async (
        pitchId: string,
        query?: {
            type?: LedgerAction;
            bookingId?: string;
            payoutId?: string;
            page?: number;
            limit?: number;
        }
    ) => {
        const ledger = await prisma.pitchLedger.findUnique({ where: { pitchId } });
        if (!ledger) {
            return { entries: [], balance: 0, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
        }

        const page = Math.max(1, query?.page ?? 1);
        const limit = Math.min(100, Math.max(1, query?.limit ?? 10));
        const skip = (page - 1) * limit;

        const where = {
            ledgerId: ledger.id,
            ...(query?.type ? { type: query.type } : {}),
            ...(query?.bookingId ? { bookingId: query.bookingId } : {}),
            ...(query?.payoutId ? { payoutId: query.payoutId } : {}),
        };

        const [entries, total] = await Promise.all([
            prisma.ledgerEntry.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.ledgerEntry.count({ where }),
        ]);

        // Compute balanceAfter for each entry (running balance).
        // balanceAfter = the ledger balance immediately after this entry was applied.
        // Newest entry's balanceAfter = current ledger balance (minus any newer entries not on this page).
        let entriesWithBalance = entries.map(e => ({ ...e, balanceAfter: 0 }));

        if (entries.length > 0) {
            let newerAmountSum = 0;

            if (skip > 0) {
                // Sum all entries (unfiltered by type/bookingId/payoutId) newer than the first entry on this page.
                const agg = await prisma.ledgerEntry.aggregate({
                    where: {
                        ledgerId: ledger.id,
                        createdAt: { gt: entries[0].createdAt },
                    },
                    _sum: { amount: true },
                });
                newerAmountSum = agg._sum.amount ?? 0;
            }

            let runningBalance = ledger.balance - newerAmountSum;

            entriesWithBalance = entries.map(entry => {
                const balanceAfter = runningBalance;
                runningBalance -= entry.amount;
                return { ...entry, balanceAfter };
            });
        }

        return {
            entries: entriesWithBalance,
            balance: ledger.balance,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    };

    static readonly createManualLedgerEntry = async (
        pitchId: string,
        entry: {
            amount: number;
            note: string;
            bookingId?: string;
        }
    ) => {
        return prisma.$transaction(async (tx) => {
            // Creating a ledger can never modify the actual normal system ledger record. Must be recorded as a user adjustment.
            return PaymentService.createLedgerEntry(tx, pitchId, { ...entry, type: LedgerAction.ADJUSTMENT });
        });
    };

    static readonly fetchLedgerEntry = async (pitchId: string, ledgerEntryId: string) => {
        const ledger = await prisma.pitchLedger.findUnique({ where: { pitchId } });
        if (!ledger) {
            throw new NotFoundError("Ledger entry not found.", ERROR_CODES.LEDGER_ENTRY_NOT_FOUND);
        }

        const entry = await prisma.ledgerEntry.findUnique({
            where: { id: ledgerEntryId }
        });

        if (!entry || entry.ledgerId !== ledger.id) {
            throw new NotFoundError("Ledger entry not found.", ERROR_CODES.LEDGER_ENTRY_NOT_FOUND);
        }

        return entry;
    };

    static readonly fetchPayout = async (pitchId: string, payoutId: string) => {
        const ledger = await prisma.pitchLedger.findUnique({ where: { pitchId } });
        if (!ledger) {
            throw new NotFoundError("Payout not found.", ERROR_CODES.PAYOUT_NOT_FOUND);
        }

        const payout = await prisma.payout.findUnique({
            where: { id: payoutId },
            include: { entries: true },
        });

        if (!payout || payout.ledgerId !== ledger.id) {
            throw new NotFoundError("Payout not found.", ERROR_CODES.PAYOUT_NOT_FOUND);
        }

        return payout;
    };
};
