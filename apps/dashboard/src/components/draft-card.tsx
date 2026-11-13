import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { components } from "@hagz/api";
import { DRAFT_CARD_ART, DRAFT_CARD_ART_SIZE } from "@/assets/map-art";
import { queries } from "@/lib/queries";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

type StaffVenue = components["schemas"]["StaffVenue"];

// The venue being set up, on first run (Figma "First run · draft card · Black, progress as top
// border", 301:2). Black among the blue invitation cards and the grey tiles, because it's the one
// thing on the screen that's already theirs and waiting on them.
//
// The line along the top edge is how far through the required items they are, so progress shows
// without a bar taking up a row of its own.
export function DraftCard({ venue, onPress }: { venue: StaffVenue; onPress: () => void }) {
  const { t } = useTranslation();
  // The counts come from the checklist, which the setup screen reads too: opening it from here
  // shows what this card promised, already loaded.
  const setup = useQuery(queries.setup(venue.id));
  const required = setup.data?.required;
  const done = required?.done ?? 0;
  const total = required?.total ?? 0;
  const status = venue.status === "DRAFT" ? "settingUp" : "inReview";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("screens.firstRun.draft.continue")}
      onPress={onPress}
      className="overflow-hidden rounded-[20px] bg-ink active:opacity-90"
    >
      <View className="h-[5px] flex-row bg-ink-track">
        <View
          className="h-full bg-primary-soft"
          style={{ width: total > 0 ? `${(done / total) * 100}%` : 0 }}
        />
      </View>
      {/* The cut corner, at the end side so Arabic mirrors it with the layout. */}
      <View
        pointerEvents="none"
        className="absolute end-0 top-0"
        style={{ transform: isRTL ? [{ scaleX: -1 }] : undefined }}
      >
        <SvgXml
          xml={DRAFT_CARD_ART}
          width={DRAFT_CARD_ART_SIZE.width}
          height={DRAFT_CARD_ART_SIZE.height}
        />
      </View>

      <View className="px-5 pb-5 pt-[22px]">
        <Text className="text-caption font-medium text-on-ink-muted">
          {t(`screens.firstRun.draft.${status}`)}
        </Text>
        <Text className="mb-1 mt-1.5 text-heading font-semibold tracking-[-0.3px] text-white">
          {venue.name ?? t("screens.setup.untitled")}
        </Text>
        {required ? (
          <Text className="text-label text-on-ink-muted">
            {t("screens.setup.progress", { done, total })}
          </Text>
        ) : null}
        <View className="mt-6 h-14 items-center justify-center rounded-full bg-white">
          <Text className="text-button font-semibold">{t("screens.firstRun.draft.continue")}</Text>
        </View>
        {required ? (
          <Text className="mt-3.5 text-center text-caption text-on-ink-muted">
            {t("screens.firstRun.draft.sendWhenDone", { count: total })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
