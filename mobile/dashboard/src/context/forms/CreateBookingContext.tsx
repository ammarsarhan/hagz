import { createFormContext } from "@/context/FormContext";
import { BookingPayload } from "@/lib/types/bookings";

const initial: BookingPayload = { firstName: "", lastName: "", role: "OWNER", phone: "", password: ""};
export const { Provider: CreateBookingFormProvider, useFormContext: useCreateBooking } = createFormContext<BookingPayload>(initial);
