import { createFormContext } from "@/context/FormContext";
import { client } from "@/lib/client";
import { parseClientError, ApiError } from "@/lib/error";
import { BookingCheckoutPayload, BookingDirectPayload } from "@/lib/types/bookings";
import { useMutation } from "@tanstack/react-query";

interface BookingPayload {
    groundId: string | null;
    customer: {
        phone: string;
        firstName: string;
        lastName: string;
    };
    startTime: Date | null;
    endTime: Date | null;
    isPaid: boolean;
    paymentMethod: BookingDirectPayload["paymentMethod"];
    channel: BookingDirectPayload["channel"];
    paymentNote: string;
}

const initial: BookingPayload = {
    groundId: null,
    customer: {
        phone: "",
        firstName: "",
        lastName: ""
    },
    startTime: null,
    endTime: null,
    isPaid: false,
    paymentMethod: "CASH",
    channel: "WHATSAPP",
    paymentNote: ""
};

export const { Provider: BookingFormProvider, useFormContext: useCreateBooking } = createFormContext<BookingPayload>(initial);

type CreateBookingParams = {
  pitchId: string;
  groundId: string;
  isPaid: boolean;
  payload: BookingDirectPayload | BookingCheckoutPayload;
};

export function useBookingMutation() {
    return useMutation({
        mutationFn: async ({ pitchId, groundId, isPaid, payload }: CreateBookingParams) => {
            const res = isPaid
                ? await client.dashboard.pitches[":pitchId"].grounds[":groundId"].bookings.direct.$post({
                    param: { pitchId, groundId },
                    json: payload as BookingDirectPayload,
                })
                : await client.dashboard.pitches[":pitchId"].grounds[":groundId"].bookings.checkout.$post({
                    param: { pitchId, groundId },
                    json: payload as BookingCheckoutPayload,
                });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data;
        },
    });
};
