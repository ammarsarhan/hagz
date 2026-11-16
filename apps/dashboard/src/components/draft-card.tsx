import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import type { components } from "@hagz/api";
import { DRAFT_CARD_ART, DRAFT_CARD_ART_SIZE } from "@/assets/map-art";
import { colors } from "@/lib/colors";
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
  // Every required item done: what's left is to look it over and send it.
  const ready = total > 0 && done >= total;
  const action = t(ready ? "screens.firstRun.draft.review" : "screens.firstRun.draft.continue");
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
      accessibilityLabel={action}
      onPress={onPress}
      className="overflow-hidden rounded-[20px] bg-ink active:opacity-90"
    >
      {/* The cut corner, at the end side so Arabic mirrors it with the layout. Before the
          progress edge in the tree, so the edge is drawn over it rather than under. */}
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
      <ProgressEdge fraction={total > 0 ? done / total : 0} />

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
          <Text className="text-button font-semibold">{action}</Text>
        </View>
        {required && !ready ? (
          <Text className="mt-3.5 text-center text-caption text-on-ink-muted">
            {t("screens.firstRun.draft.sendWhenDone")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// The progress line along the card's top edge. It fills from empty when the card first shows, then
// glides to each new value (an item finished in setup), so the progress reads as movement rather
// than a fixed bar. Measured in points from the track's width: Reanimated animates numbers, not
// percentages.
const FILL_DELAY = 150;
const FILL_DURATION = 700;

function ProgressEdge({ fraction }: { fraction: number }) {
  const [track, setTrack] = useState(0);
  const width = useSharedValue(0);
  useEffect(() => {
    if (track === 0) return;
    width.value = withDelay(
      FILL_DELAY,
      withTiming(fraction * track, { duration: FILL_DURATION, easing: Easing.out(Easing.cubic) }),
    );
  }, [fraction, track, width]);
  const fill = useAnimatedStyle(() => ({ width: width.value }));
  return (
    <View
      className="h-[5px] flex-row bg-ink-track"
      onLayout={(event) => setTrack(event.nativeEvent.layout.width)}
    >
      {/* Styled by props: NativeWind's classes don't reach Reanimated's view. */}
      <Animated.View style={[{ height: "100%", backgroundColor: colors.primarySoft }, fill]} />
    </View>
  );
}
