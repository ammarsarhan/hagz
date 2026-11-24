import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "./text";

// What an entry in the Bookings tab is (user, 2026-11-23): a booking of your own, a game you joined,
// or (Phase 4b) a tournament. Small and grey, so it tells them apart without competing with the
// time and the venue.

export type EntryKind = "BOOKING" | "GAME" | "TOURNAMENT";

export function KindTag({ kind }: { kind: EntryKind }) {
  const { t } = useTranslation();
  return (
    <View className="h-5 justify-center rounded-md bg-chip px-1.5">
      <Text className="text-[11px] leading-[14px] font-medium text-ink-2">
        {t(`screens.bookings.kinds.${kind}`)}
      </Text>
    </View>
  );
}
