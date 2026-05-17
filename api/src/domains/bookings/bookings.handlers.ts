import { createFactory } from "hono/factory";
import validate from "@/shared/middleware/validate.middleware.js";
import guard from "@/domains/pitches/pitches.middleware.js";
import { authorize } from "@/domains/auth/auth.middleware.js";
import { createUserBookingSchema, createStaffBookingSchema } from "@/domains/bookings/bookings.validator.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import BookingService from "@/domains/bookings/bookings.service.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";

const factory = createFactory();
const bookingService = new BookingService();

export const createStaffBookingHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.WRITE),
    validate("json", createStaffBookingSchema),
    async (c) => {
        const initiatorId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const payload = c.req.valid("json");

        const booking = await bookingService.createStaffBooking(initiatorId, pitchId, groundId, payload);
        return c.json({ success: true, data: { booking } }, 200); 
    }
);

export const createUserBookingHandler = factory.createHandlers(
    authorize,
    validate("json", createUserBookingSchema),
    async (c) => {
        
    }
);

export const fetchBookingHandler = factory.createHandlers(
    async (c) => {

    }
);
