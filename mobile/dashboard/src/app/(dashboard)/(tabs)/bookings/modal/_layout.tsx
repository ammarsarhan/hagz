import { BookingFormProvider } from "@/context/forms/CreateBookingContext";
import { Stack } from "expo-router";

export default function BookingModalLayout() {
    return (
        <BookingFormProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "#FFF" },
                    gestureEnabled: false
                }}
            />
        </BookingFormProvider>
    )
}