import z from "zod";
import { LedgerAction, PayoutMethod, PayoutStatus, PayoutTrigger } from "@/generated/prisma/enums.js";

export const fetchPayoutsQuerySchema = z.object({
    status: z.enum(Object.values(PayoutStatus)).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
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
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const createLedgerEntrySchema = z.object({
    amount: z.number("Amount must be a valid int.").int("Amount must be a valid int.").min(-5000, "Amount may not be smaller than EGP -5000.00").max(0, "Amount may not be larger than EGP 0.00"),
    bookingId: z.string("Please use a valid booking CUID.").optional(),
    note: z.string("Note to explain the manual adjustment is required.").max(500),
});

export type FetchPayoutsQueryType = z.infer<typeof fetchPayoutsQuerySchema>;
export type CreatePayoutPayloadType = z.infer<typeof createPayoutSchema>;
export type FetchLedgerEntriesQueryType = z.infer<typeof fetchLedgerEntriesQuerySchema>;
export type CreateLedgerEntryPayloadType = z.infer<typeof createLedgerEntrySchema>;
