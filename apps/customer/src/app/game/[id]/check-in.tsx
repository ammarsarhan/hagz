import { useLocalSearchParams } from "expo-router";
import { CheckInScreen } from "@/components/check-in-screen";
import i18n from "@/i18next/i18next";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { kindOf } from "@/lib/venue";

// A joined game's check-in: the player's own code, from the booker's game
// (components/check-in-screen.tsx).

export default function GameCheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <CheckInScreen
      id={id}
      source={{
        read: async () => {
          const result = await send(
            api.GET("/v1/games/{gameId}", { params: { path: { gameId: id } } }),
          );
          if (!result.ok) return result;
          const game = result.data;
          return {
            ok: true,
            data: {
              role: i18n.t("screens.checkIn.player", { name: game.booker.firstName }),
              groundName: game.ground.name ?? kindOf(game.ground),
              startsAt: game.startsAt,
              endsAt: game.endsAt,
              timezone: game.timezone,
              venueName: game.venue.name ?? i18n.t("screens.venue.fallbackName"),
              checkIn: game.me?.checkIn ?? null,
            },
          };
        },
        code: () =>
          send(api.GET("/v1/games/{gameId}/check-in-code", { params: { path: { gameId: id } } })),
      }}
    />
  );
}
