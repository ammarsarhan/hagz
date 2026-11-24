import { useLocalSearchParams } from "expo-router";
import { CheckInScreen } from "@/components/check-in-screen";
import i18n from "@/i18next/i18next";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { kindOf } from "@/lib/venue";

// A booking's check-in: the booker's code (components/check-in-screen.tsx).

export default function BookingCheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <CheckInScreen
      id={id}
      source={{
        read: async () => {
          const result = await send(
            api.GET("/v1/bookings/{bookingId}", { params: { path: { bookingId: id } } }),
          );
          if (!result.ok) return result;
          const booking = result.data;
          return {
            ok: true,
            data: {
              role: i18n.t("screens.checkIn.booker"),
              groundName: booking.ground.name ?? kindOf(booking.ground),
              startsAt: booking.startsAt,
              endsAt: booking.endsAt,
              timezone: booking.venue.timezone,
              venueName: booking.venue.name ?? i18n.t("screens.venue.fallbackName"),
              checkIn: booking.checkIn,
            },
          };
        },
        code: () =>
          send(
            api.GET("/v1/bookings/{bookingId}/check-in-code", {
              params: { path: { bookingId: id } },
            }),
          ),
      }}
    />
  );
}
