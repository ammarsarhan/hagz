import { createFactory } from "hono/factory";
import { authorize } from "@/domains/auth/auth.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { createUserBookingSchema, createStaffBookingSchema } from "@/domains/bookings/bookings.validator.js";
import guard from "@/domains/pitches/pitches.middleware.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";

const factory = createFactory();

export const createUserBookingHandler = factory.createHandlers(
    authorize,
    validate("json", createUserBookingSchema),
    async (c, next) => {
        
    }
);

export const createStaffBookingHandler = factory.createHandlers(
    guard("bookings", PermissionLevel.WRITE),
    validate("json", createStaffBookingSchema),
    async (c, next) => {
        
    }
);

export const fetchBookingHandler = factory.createHandlers(
    async (c, next) => {

    }
);
