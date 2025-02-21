import { newReservation, checkReservationDateConflict } from "../repositories/reservationRepository";
import { z } from "zod";

export async function createReservation(pitchId: string, name: string, phone: string, startDate: Date, endDate: Date, userId?: string) {
    try {
        const schema = z.object({
            pitchId: z.string().uuid("Please provide a valid UUID for the pitch ID."),
            name: z.string({ message: "Please provide a reservee name." }).min(2, { message: "Name must contain at least 2 characters." }).max(100, { message: "Name may not have more than 100 characters." }),
            phone: z.string().regex(/^\d{4}-\d{3}-\d{4}$/, "Please provide a valid phone number."),
            startDate: z.date(),
            endDate: z.date(),
            userId: z.string().uuid("Please provide a valid UUID for the user ID.").optional()
        });

        const parsed = schema.safeParse({ pitchId, name, phone, startDate, endDate, userId });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const dateConflict = await checkReservationDateConflict(pitchId, startDate, endDate);

        if (!dateConflict) {
            throw new Error("Could not reserve for the specified date. Please pick an empty reservation slot.");
        }

        

    } catch (error: any) {
        throw new Error(error.message);
    }
}