import { createFormContext } from "@/context/FormContext";
import { BookingDirectPayload } from "@/lib/types/bookings";

interface BookingPayload {
    groundId: string | null;
    customer: {
        phone: string;
        firstName: string;
        lastName: string;
    };
    startTime: Date | null;
    endTime: Date | null;
    // paymentMethod: BookingDirectPayload["paymentMethod"];
    // channel: BookingDirectPayload["channel"];
    // paymentNote: string;
}

const initial: BookingPayload = {
    groundId: null,
    customer: {
        phone: "",
        firstName: "",
        lastName: ""
    },
    startTime: null,
    endTime: null
};

export const { Provider: BookingFormProvider, useFormContext: useCreateBooking } = createFormContext<BookingPayload>(initial);
