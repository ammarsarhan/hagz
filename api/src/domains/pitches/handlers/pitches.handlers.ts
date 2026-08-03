import { createFactory } from "hono/factory";

import { authorize } from "@/domains/auth/auth.middleware.js";
import PitchService from "@/domains/pitches/services/pitches.service.js";
import { updatePitchSchema, fetchPitchAvailabilitySchema, createPitchSchema, fetchPitchFeedSchema, getStaffBookingsFiltersSchema, fetchPitchCustomersSchema } from "@/domains/pitches/pitches.validator.js";

import guard from "@/domains/pitches/pitches.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import { locale } from "@/shared/middleware/locale.middleware.js";

const factory = createFactory();
const pitchService = new PitchService();

export const getDashboardPitchesHandler = factory.createHandlers(
    authorize({ required: true }),
    guard("properties", PermissionLevel.READ),
    async (c) => {
        const userId = c.var.id;

        const pitches = await pitchService.fetchDashboardPitches(userId);
        return c.json({ success: true, data: { pitches }}, 200);
    }
);

export const createPitchHandler = factory.createHandlers(
    authorize({ required: true }),
    validate("json", createPitchSchema),
    async (c) => {
        const userId = c.var.id;
        const payload = c.req.valid("json");

        const { pitch, profile } = await pitchService.createPitch(userId, payload);

        return c.json({ success: true, data: { pitch, profile }}, 201);
    }
);

export const getUserPitchHandler = factory.createHandlers(
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const pitch = await pitchService.fetchUserPitch(pitchId);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
);

export const getDashboardHomeHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        const pitch = await pitchService.fetchDashboardHome(pitchId);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
);

export const getDashboardPitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        const pitch = await pitchService.fetchDashboardPitch(pitchId);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
);

export const updatePitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    validate("json", updatePitchSchema),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");
        
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const { updated, profile } = await pitchService.updatePitch(userId, pitchId, payload);
        
        return c.json({ success: true, data: { pitch: updated, profile }}, 200);
    }
);

export const submitPitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const { updated, profile } = await pitchService.submitPitch(pitchId, userId);
        return c.json({ success: true, data: { pitch: updated, profile } }, 200); 
    }
);

export const deactivatePitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.deactivatePitch(pitchId);
        return c.json({ success: true, data: { pitch } }, 200); 
    }
);

export const activatePitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.activatePitch(pitchId);
        return c.json({ success: true, data: { pitch } }, 200); 
    }
);

export const fetchPitchAvailabilityHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.READ),
    validate("query", fetchPitchAvailabilitySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const target = c.req.query("target");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const availability = await pitchService.fetchAvailability(pitchId, target);
        return c.json({ success: true, data: { availability }}, 200);
    }
);

export const fetchPitchesFeedHandler = factory.createHandlers(
    locale,
    authorize({ required: false }),
    validate("query", fetchPitchFeedSchema),
    async (c) => {
        const locale = c.var.locale;
        const userId = c.var.id;
        const payload = c.req.valid("query");

        const pitches = await pitchService.fetchFeed(payload, userId, locale);
        return c.json({ success: true, data: { ...pitches } }, 200);
    }
);

export const addFavoriteHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");

        if (!pitchId)
            throw new NotFoundError("Pitch ID was not provided.", ERROR_CODES.PITCH_NOT_FOUND);

        const result = await pitchService.toggleFavorite(userId, pitchId, true);
        return c.json({ success: true, data: result }, 201);
    }
);

export const removeFavoriteHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");

        if (!pitchId)
            throw new NotFoundError("Pitch ID was not provided.", ERROR_CODES.PITCH_NOT_FOUND);

        const result = await pitchService.toggleFavorite(userId, pitchId, false);
        return c.json({ success: true, data: result }, 200);
    }
);

export const fetchUserFavoritesHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const favorites = await pitchService.fetchUserFavorites(userId);
        return c.json({ success: true, data: favorites }, 200);
    }
);

export const fetchStaffPitchBookingsHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.READ),
    validate("query", getStaffBookingsFiltersSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const filters = c.req.valid("query");
        const slots = await pitchService.fetchStaffBookings(pitchId, filters);

        return c.json({ success: true, data: { ...slots } }, 200);
    }
);

export const fetchPitchCustomersHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.READ),
    validate("query", fetchPitchCustomersSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const { phone } = c.req.valid("query");
        const data = await pitchService.fetchPitchCustomer(pitchId, phone);

        return c.json({ success: true, data: { ...data } }, 200);
    }
);
