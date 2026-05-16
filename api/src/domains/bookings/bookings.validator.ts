import z from "zod";

export type CreateUserBookingPayloadType = z.infer<typeof createUserBookingSchema>;

export const createUserBookingSchema = z.object({

});

export type CreateStaffBookingPayloadType = z.infer<typeof createStaffBookingSchema>;

export const createStaffBookingSchema = z.object({

});
