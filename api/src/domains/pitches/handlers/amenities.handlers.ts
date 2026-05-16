import { createFactory } from "hono/factory";
import AmenityService from "@/domains/pitches/services/amenities.service.js";
import guard from "@/domains/pitches/pitches.middleware.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import { createPitchAmenitySchema, updatePitchAmenitySchema } from "@/domains/pitches/pitches.validator.js";
import validate from "@/shared/middleware/validate.middleware.js";

const factory = createFactory();
const amenityService = new AmenityService();

export const getPitchAmenityHandler = factory.createHandlers(
    guard("properties", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const order = c.req.param("order");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!order || parseInt(order) < 1 || parseInt(order) > 10)
            throw new BadRequestError("Amenity order must be a valid number from 1 to 10.", ERROR_CODES.VALIDATION_FAILED);
        
        const amenity = await amenityService.fetchPitchAmenity(pitchId, parseInt(order));
        return c.json({ success: true, data: { amenity } }, 200);
    }
);

export const getPitchAmenitiesHandler = factory.createHandlers(
    guard("properties", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const amenities = await amenityService.fetchPitchAmenities(pitchId);
        return c.json({ success: true, data: { amenities } }, 200);
    }
);

export const createPitchAmenityHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    validate("json", createPitchAmenitySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const amenity = await amenityService.createPitchAmenity(pitchId, payload);
        return c.json({ success: true, data: { amenity } }, 200);
    }
);

export const updatePitchAmenityHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    validate("json", updatePitchAmenitySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const order = c.req.param("order");
        const payload = c.req.valid("json");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!order || parseInt(order) < 1 || parseInt(order) > 10)
            throw new BadRequestError("Amenity order must be a valid number from 1 to 10.", ERROR_CODES.VALIDATION_FAILED);

        const amenity = await amenityService.updatePitchAmenity(pitchId, parseInt(order), payload);
        return c.json({ success: true, data: { amenity } }, 200);
    }
);

export const deletePitchAmenityHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const order = c.req.param("order");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!order || parseInt(order) < 1 || parseInt(order) > 10)
            throw new BadRequestError("Amenity order must be a valid number from 1 to 10.", ERROR_CODES.VALIDATION_FAILED);

        await amenityService.deletePitchAmenity(pitchId, parseInt(order));
        return c.json({ success: true, data: null }, 200);
    }
);
