import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { components } from "@hagz/api";
import { DRAFT_CARD_ART, DRAFT_CARD_ART_SIZE } from "@/assets/map-art";
import { queries } from "@/lib/queries";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

type StaffVenue = components["schemas"]["StaffVenue"];

// How long ago the venue last changed, in the largest whole unit: under a minute is "just now".
// Worked out when the card renders, like an invitation's time left.
const sinceLastActivity = (lastActivityAt: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.floor((now - new Date(lastActivityAt).getTime()) / 60_000));
  if (minutes < 1) return { unit: "now" } as const;
  if (minutes < 60) return { unit: "minutes", count: minutes } as const;
  if (minutes < 24 * 60) return { unit: "hours", count: Math.floor(minutes / 60) } as const;
  return { unit: "days", count: Math.floor(minutes / (24 * 60)) } as const;
};

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
  const [updatedWrapped, setUpdatedWrapped] = useState(false);
  const since = sinceLastActivity(venue.lastActivityAt);
  const lastUpdated =
    since.unit === "now"
      ? t("screens.firstRun.draft.updatedNow")
      : since.unit === "minutes"
        ? t("screens.firstRun.draft.updatedMinutes", { count: since.count })
        : since.unit === "hours"
          ? t("screens.firstRun.draft.updatedHours", { count: since.count })
          : t("screens.firstRun.draft.updatedDays", { count: since.count });

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
        {venue.location ? (
          <Text className="text-label text-on-ink-muted" numberOfLines={1}>
            {venue.location}
          </Text>
        ) : null}
        {/* "3 of 7 required done · Last updated 30 minutes ago", or on two lines when it doesn't
            fit. As on the invitation card, the dot stays laid out when they wrap, only hidden, so
            the wrap can't flip back. */}
        <View className="flex-row flex-wrap">
          {required ? (
            <Text className="text-label text-on-ink-muted">
              {t("screens.setup.progress", { done, total })}
              <Text
                className="text-label text-on-ink-muted"
                style={updatedWrapped ? { color: "transparent" } : undefined}
              >
                {" · "}
              </Text>
            </Text>
          ) : null}
          <Text
            className="text-label text-on-ink-muted"
            onLayout={(e) => setUpdatedWrapped(e.nativeEvent.layout.y > 0)}
          >
            {lastUpdated}
          </Text>
        </View>
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
