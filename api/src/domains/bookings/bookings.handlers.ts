import { createFactory } from "hono/factory";
import validate from "@/shared/middleware/validate.middleware.js";
import guard from "@/domains/pitches/pitches.middleware.js";
import { authorize } from "@/domains/auth/auth.middleware.js";
import { createStaffCheckoutBookingSchema, createStaffDirectBookingSchema, createUserBookingSchema, rescheduleUserBookingSchema } from "@/domains/bookings/bookings.validator.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import BookingService from "@/domains/bookings/bookings.service.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";

const factory = createFactory();
const bookingService = new BookingService();

export const createStaffCheckoutBookingHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.WRITE),
    validate("json", createStaffCheckoutBookingSchema),
    async (c) => {
        const initiatorId = c.var.id;

        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const payload = c.req.valid("json");
        const result = await bookingService.createStaffCheckoutBooking(initiatorId, pitchId, groundId, payload);

        return c.json({ success: true, data: { ...result } }, 201);
    }
);

export const createStaffDirectBookingHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.WRITE),
    validate("json", createStaffDirectBookingSchema),
    async (c) => {
        const initiatorId = c.var.id;

        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const payload = c.req.valid("json");
        const result = await bookingService.createStaffDirectBooking(initiatorId, pitchId, groundId, payload);

        return c.json({ success: true, data: { ...result } }, 201);
    }
);

export const createUserBookingHandler = factory.createHandlers(
    authorize({ required: true }),
    validate("json", createUserBookingSchema),
    async (c) => {
        const userId = c.var.id;
        const phone = c.var.phone;
        const payload = c.req.valid("json");

        const { booking, checkout } = await bookingService.createUserBooking(userId, phone, payload);
        return c.json({ success: true, data: { booking, checkout } }, 201); 
    }
);

export const fetchUserBookingHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const bookingId = c.req.param("bookingId");

        if (!bookingId)
            throw new BadRequestError("Could not find booking with the specified ID.", ERROR_CODES.BOOKING_NOT_FOUND);

        const booking = await bookingService.fetchUserBooking(userId, bookingId);
        return c.json({ success: true, data: { booking } }, 200); 
    }
);

export const fetchUserBookingsHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const cursor = c.req.query("cursor");

        const data = await bookingService.fetchUserBookings(userId, cursor);
        return c.json({ success: true, data: { ...data } }, 200); 
    }
);

export const cancelUserBookingHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const bookingId = c.req.param("bookingId");

        if (!bookingId)
            throw new BadRequestError("Could not find booking with the specified ID.", ERROR_CODES.BOOKING_NOT_FOUND);

        const booking = await bookingService.cancelUserBooking(userId, bookingId);
        return c.json({ success: true, data: { booking } }, 200); 
    }
);

export const rescheduleUserBookingHandler = factory.createHandlers(
    authorize({ required: true }),
    validate("json", rescheduleUserBookingSchema),
    async (c) => {
        const userId = c.var.id;
        const bookingId = c.req.param("bookingId");

        if (!bookingId)
            throw new BadRequestError("Could not find booking with the specified ID.", ERROR_CODES.BOOKING_NOT_FOUND);

        const payload = c.req.valid("json");

        const booking = await bookingService.rescheduleUserBooking(userId, bookingId, payload);
        return c.json({ success: true, data: { booking } }, 200); 
    }
)
