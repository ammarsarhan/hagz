import { createFactory } from "hono/factory";
import validate from "@/shared/middleware/validate.middleware.js";
import guard from "@/domains/pitches/pitches.middleware.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import PaymentService from "@/domains/payments/payments.service.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import {
    createLedgerEntrySchema,
    createPayoutSchema,
    fetchLedgerEntriesQuerySchema,
    fetchPayoutsQuerySchema,
    updateLedgerEntrySchema,
} from "@/domains/payments/payments.validator.js";

const factory = createFactory();

export const fetchPayoutsHandler = factory.createHandlers(
    guard("payments", PermissionLevel.READ),
    validate("query", fetchPayoutsQuerySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const query = c.req.valid("query");
        const result = await PaymentService.fetchPayouts(pitchId, query);

        return c.json({ success: true, data: { ...result } }, 200);
    }
);

export const createPayoutHandler = factory.createHandlers(
    guard("payments", PermissionLevel.WRITE),
    validate("json", createPayoutSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const payload = c.req.valid("json");
        const payout = await PaymentService.createPayout(pitchId, payload);

        return c.json({ success: true, data: { payout } }, 201);
    }
);

export const fetchLedgerEntriesHandler = factory.createHandlers(
    guard("payments", PermissionLevel.READ),
    validate("query", fetchLedgerEntriesQuerySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const query = c.req.valid("query");
        const result = await PaymentService.fetchLedgerEntries(pitchId, query);

        return c.json({ success: true, data: { ...result } }, 200);
    }
);

export const createLedgerEntryHandler = factory.createHandlers(
    guard("payments", PermissionLevel.WRITE),
    validate("json", createLedgerEntrySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const payload = c.req.valid("json");
        const entry = await PaymentService.createManualLedgerEntry(pitchId, payload);

        return c.json({ success: true, data: { entry } }, 201);
    }
);

export const updateLedgerEntryHandler = factory.createHandlers(
    guard("payments", PermissionLevel.WRITE),
    validate("json", updateLedgerEntrySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const payload = c.req.valid("json");
        const result = await PaymentService.updateLedgerEntry(pitchId, payload);

        return c.json({ success: true, data: { ...result } }, 200);
    }
);

export const fetchLedgerEntryHandler = factory.createHandlers(
    guard("payments", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const ledgerId = c.req.param("ledgerId");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!ledgerId)
            throw new BadRequestError("Ledger entry ID must be provided.", ERROR_CODES.LEDGER_ENTRY_NOT_FOUND);

        const entry = await PaymentService.fetchLedgerEntry(pitchId, ledgerId);

        return c.json({ success: true, data: { entry } }, 200);
    }
);

export const fetchPayoutHandler = factory.createHandlers(
    guard("payments", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const payoutId = c.req.param("payoutId");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!payoutId)
            throw new BadRequestError("Payout ID must be provided.", ERROR_CODES.PAYOUT_NOT_FOUND);

        const payout = await PaymentService.fetchPayout(pitchId, payoutId);

        return c.json({ success: true, data: { payout } }, 200);
    }
);
