import z from "zod";
import { LedgerAction, PayoutMethod, PayoutStatus, PayoutTrigger } from "@/generated/prisma/enums.js";

export const fetchPayoutsQuerySchema = z.object({
    status: z.enum(Object.values(PayoutStatus)).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createPayoutSchema = z.object({
    amount: z.number().int().positive("Payout amount must be greater than zero."),
    method: z.enum(Object.values(PayoutMethod)),
    destination: z.string().min(1, "Destination details are required."),
    trigger: z.enum(Object.values(PayoutTrigger)).optional().default(PayoutTrigger.MANUAL),
});

export const fetchLedgerEntriesQuerySchema = z.object({
    type: z.enum(Object.values(LedgerAction)).optional(),
    bookingId: z.string().optional(),
    payoutId: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createLedgerEntrySchema = z.object({
    type: z.enum(Object.values(LedgerAction)),
    amount: z.number().int(),
    bookingId: z.string().optional(),
    note: z.string().max(500).optional(),
});

export const updateLedgerEntrySchema = z.object({
    entryId: z.cuid("Use a valid ledger entry CUID."),
    note: z.string().max(500).optional(),
    amount: z.number().int().optional(),
    type: z.enum(Object.values(LedgerAction)).optional(),
    reason: z.string().max(500).optional(),
});

export type FetchPayoutsQueryType = z.infer<typeof fetchPayoutsQuerySchema>;
export type CreatePayoutPayloadType = z.infer<typeof createPayoutSchema>;
export type FetchLedgerEntriesQueryType = z.infer<typeof fetchLedgerEntriesQuerySchema>;
export type CreateLedgerEntryPayloadType = z.infer<typeof createLedgerEntrySchema>;
export type UpdateLedgerEntryPayloadType = z.infer<typeof updateLedgerEntrySchema>;
