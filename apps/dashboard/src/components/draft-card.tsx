import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { components } from "@hagz/api";
import { DRAFT_CARD_ART, DRAFT_CARD_ART_SIZE } from "@/assets/map-art";
import { queries } from "@/lib/queries";
import { isRTL } from "@/lib/language";
import { useNow } from "@/lib/use-now";
import { Text } from "./text";

type StaffVenue = components["schemas"]["StaffVenue"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// How long ago the venue last changed, in the largest whole unit (under a minute is "just now"), and
// when that will next read differently: the next whole minute, hour or day since the change.
const sinceLastActivity = (lastActivityAt: string, now: number) => {
  const at = new Date(lastActivityAt).getTime();
  const elapsed = Math.max(0, now - at);
  const step = elapsed < HOUR ? MINUTE : elapsed < DAY ? HOUR : DAY;
  const count = Math.floor(elapsed / step);
  const changesAt = at + (count + 1) * step;
  if (elapsed < MINUTE) return { unit: "now", changesAt } as const;
  const unit = step === MINUTE ? "minutes" : step === HOUR ? "hours" : "days";
  return { unit, count, changesAt } as const;
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
  // Redrawn as the time passes, so it doesn't stay on "30 minutes ago" while first run is left open.
  const now = useNow((time) => sinceLastActivity(venue.lastActivityAt, time).changesAt);
  const since = sinceLastActivity(venue.lastActivityAt, now);
  // "2m ago": short, since it heads the card on its own.
  const ago =
    since.unit === "now"
      ? t("screens.firstRun.draft.agoNow")
      : t(`screens.firstRun.draft.ago.${since.unit}`, { count: since.count });

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
          {venue.status === "DRAFT" ? ago : t("screens.firstRun.draft.inReview", { ago })}
        </Text>
        <Text className="mb-1 mt-1.5 text-heading font-semibold tracking-[-0.3px] text-white">
          {venue.name ?? t("screens.setup.untitled")}
        </Text>
        {venue.location ? (
          <Text className="text-label text-on-ink-muted" numberOfLines={1}>
            {venue.location}
          </Text>
        ) : null}
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
            {t("screens.firstRun.draft.sendWhenDone")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
