import type { components } from "@hagz/api";
import { Image } from "expo-image";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, View } from "react-native";
import i18n from "@/i18next/i18next";
import { colors } from "@/lib/colors";
import { fromPerHour } from "@/lib/money";
import { push } from "@/lib/navigation";
import { groundsText, type VenueCard } from "@/lib/search";
import { localTimeOf } from "@/lib/ground-filter";
import { dayLabel, hourAt, kindOf, localDateOf, timeOfDay } from "@/lib/venue";
import { reachable } from "@/lib/api";
import { nextDateFor, type PlayedVenue, type SavedVenue } from "@/lib/home";
import { intlLocale } from "@/lib/language";
import { Bone } from "./bone";
import { IconQrcode, IconStarFilled } from "./icons";
import { Cover, CoverBadge, openVenue, placeText, Rating } from "./search-cards";
import { SpotsRow } from "./spots-row";
import { Text } from "./text";

// Home's rails (Figma C12, 311:2–313:2): a heading with what it's about and See all, then a row of
// cards that scrolls sideways from the page's gutter. Venue cards come wide (with their free times,
// Free tonight) or narrow (a cover badge instead: Instant, #1, New); games as a bordered card with
// the spots row. And the black next-game ticket at the top for a signed-in player.

type Game = components["schemas"]["Game"];

const GUTTER = 24;
// Between the cards in a rail; wider between the wide cards (Free tonight, user 2026-11-23).
const GAP = 16;
const WIDE_GAP = 24;
const WIDE = 250;
const NARROW = 168;
const GAME = 232;
const AGAIN = 280;
const EVENING = 17;

// "Tonight", "Today", "Tomorrow", or "Thu 26 Nov", in the venue's time.
export const whenDay = (iso: string, timezone: string) => {
  const today = localDateOf(new Date().toISOString(), timezone);
  const tomorrow = localDateOf(new Date(Date.now() + 86_400_000).toISOString(), timezone);
  const date = localDateOf(iso, timezone);
  if (date === today)
    return hourAt(iso, timezone) >= EVENING
      ? i18n.t("screens.home.tonight")
      : i18n.t("formats.today");
  if (date === tomorrow) return i18n.t("formats.tomorrow");
  return dayLabel(date);
};

export function Rail<T>({
  title,
  line,
  onSeeAll,
  items,
  keyOf,
  render,
  width,
}: {
  title: string;
  line?: string;
  onSeeAll?: () => void;
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  width: number;
}) {
  const { t } = useTranslation();
  const gap = width === WIDE ? WIDE_GAP : GAP;
  return (
    <View className="pt-8">
      {/* See all sits level with the middle of the title and its line. */}
      <View className="flex-row items-center justify-between gap-4 px-6">
        <View className="shrink">
          <Text accessibilityRole="header" className="text-[18px] leading-6 font-semibold">
            {title}
          </Text>
          {line ? (
            <Text className="pt-0.5 text-caption leading-[18px] text-ink-2">{line}</Text>
          ) : null}
        </View>
        {onSeeAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("screens.home.seeAllOf", { title })}
            hitSlop={8}
            onPress={onSeeAll}
            className="active:opacity-60"
          >
            <Text className="text-label leading-5 font-medium underline">
              {t("screens.home.seeAll")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyOf}
        renderItem={({ item }) => <View style={{ width }}>{render(item)}</View>}
        showsHorizontalScrollIndicator={false}
        // Free scrolling, like the app's other sideways rows (no snapping).
        contentContainerStyle={{ gap, paddingHorizontal: GUTTER, paddingTop: 14 }}
      />
    </View>
  );
}

export const RAIL_WIDTH = { wide: WIDE, narrow: NARROW, game: GAME, again: AGAIN };

// A rail on its way: its heading and cards as grey stand-ins, in the real sizes.
export function RailSkeleton({ kind }: { kind: "wide" | "narrow" | "game" }) {
  const width = RAIL_WIDTH[kind];
  return (
    <View
      className="pt-8"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="gap-1.5 px-6">
        <Bone className="h-5 w-40 rounded-md" />
        {kind === "wide" ? <Bone className="h-3.5 w-48 rounded-md" /> : null}
      </View>
      <View
        className="flex-row overflow-hidden px-6 pt-3.5"
        style={{ gap: kind === "wide" ? WIDE_GAP : GAP }}
      >
        {[0, 1, 2].map((i) =>
          kind === "game" ? (
            <Bone key={i} className="h-[116px] rounded-2xl" style={{ width }} />
          ) : (
            <View key={i} style={{ width }} className="gap-2">
              <Bone className={`${kind === "wide" ? "h-[150px]" : "h-[112px]"} rounded-2xl`} />
              <Bone className="mt-1 h-4 w-3/4 rounded-md" />
              <Bone className="h-3 w-1/2 rounded-md" />
            </View>
          ),
        )}
      </View>
    </View>
  );
}

// "Thursdays, 9 pm": a usual weekday and time, both on the venue's clock.
const usualText = (usual: { weekday: number; start: string }) => {
  // 2026-11-01 was a Sunday: weekday 0.
  const day = new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 10, 1 + usual.weekday, 12)),
  );
  return i18n.t("screens.home.usual", {
    day,
    time: timeOfDay(`2026-11-01T${usual.start}:00Z`, "UTC"),
  });
};

// A venue played at: its cover, name, the usual time (or when last played), and Book, which opens
// the venue on the next such day and time.
export function PlayAgainCard({ entry }: { entry: PlayedVenue }) {
  const { t } = useTranslation();
  const { venue, usual } = entry;
  const name = venue.name ?? t("screens.venue.fallbackName");
  const date = usual ? nextDateFor(usual, venue.timezone) : null;
  const open = () =>
    push({
      pathname: "/venue/[slug]",
      params: {
        slug: venue.slug,
        ...(usual && date ? { date, start: usual.start, hours: String(usual.hours) } : {}),
      },
    });
  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      className="flex-row items-center gap-3 rounded-[18px] border border-border p-3 active:opacity-70"
    >
      <Thumb url={venue.cover?.url ?? null} size={56} />
      <View className="flex-1">
        <Text className="text-body leading-5 font-medium" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-caption leading-[18px] text-ink-2" numberOfLines={1}>
          {usual
            ? usualText(usual)
            : t("screens.home.lastPlayed", {
                date: dayLabel(localDateOf(entry.lastPlayed, venue.timezone)),
              })}
        </Text>
      </View>
      <View className="h-[34px] justify-center rounded-full bg-chip px-3">
        <Text className="text-caption leading-[18px] font-semibold">{t("screens.home.book")}</Text>
      </View>
    </Pressable>
  );
}

// A saved venue: a narrow card without a price (the saved list has none).
export function SavedCard({ venue }: { venue: SavedVenue }) {
  const { t } = useTranslation();
  const name = venue.name ?? t("screens.venue.fallbackName");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("screens.search.card.open", { name })}
      onPress={() => push({ pathname: "/venue/[slug]", params: { slug: venue.slug } })}
    >
      <Thumb url={venue.cover?.url ?? null} size={NARROW} height={112} />
      <View className="mt-3 flex-row items-center justify-between gap-2">
        <Text className="shrink text-body leading-[22px] font-medium" numberOfLines={1}>
          {name}
        </Text>
        {venue.rating.average === null ? null : (
          <View className="flex-row items-center gap-0.5">
            <IconStarFilled size={12} color={colors.ink} />
            <Text className="text-label leading-5 font-medium">
              {venue.rating.average.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-caption leading-[18px] text-ink-2" numberOfLines={1}>
        {venue.area ?? ""}
      </Text>
    </Pressable>
  );
}

// A cover by its url (expo-image sizes by style, not class names).
function Thumb({ url, size, height }: { url: string | null; size: number; height?: number }) {
  const style = {
    width: size,
    height: height ?? size,
    borderRadius: height ? 16 : 12,
    backgroundColor: "#c4c8cf",
  };
  return url ? (
    <Image source={{ uri: reachable(url) }} style={style} contentFit="cover" transition={150} />
  ) : (
    <View style={style} />
  );
}

// A venue in a rail: wide with its free times (Free tonight), or narrow with a badge on the cover.
export const RailVenueCard = memo(function RailVenueCard({
  card,
  currency,
  timezone,
  wide = false,
  badge,
}: {
  card: VenueCard;
  currency: string;
  timezone: string;
  wide?: boolean;
  badge?: string | null;
}) {
  const { t } = useTranslation();
  const name = card.name ?? t("screens.venue.fallbackName");
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("screens.search.card.open", { name })}
        onPress={() => openVenue(card, {})}
      >
        <View>
          <Cover
            card={card}
            style={{ width: "100%", height: wide ? 150 : 112, borderRadius: 16 }}
          />
          {badge ? (
            <View pointerEvents="none" className="absolute top-2.5 left-2.5">
              <CoverBadge badge={{ label: badge, moment: false }} />
            </View>
          ) : null}
        </View>
        <View className="mt-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text
              className={`shrink ${wide ? "text-subtitle" : "text-body"} leading-[22px] font-medium`}
              numberOfLines={1}
            >
              {name}
            </Text>
            {card.rating.average === null ? null : <Rating card={card} compact />}
          </View>
          <Text className="text-caption leading-[18px] text-ink-2" numberOfLines={1}>
            {placeText(card)}
          </Text>
          <Text className="pt-1 text-label leading-5 font-medium" numberOfLines={1}>
            {fromPerHour(card.priceFrom, currency)}
          </Text>
        </View>
      </Pressable>
      {wide && card.nextTimes.length > 0 ? (
        <View className="mt-2.5 flex-row gap-2">
          {card.nextTimes.slice(0, 2).map((time) => (
            <Pressable
              key={time.startsAt}
              accessibilityRole="button"
              accessibilityLabel={t("screens.search.card.atTime", {
                venue: name,
                time: timeOfDay(time.startsAt, timezone),
              })}
              onPress={() =>
                openVenue(card, {
                  date: localDateOf(time.startsAt, timezone),
                  start: localTimeOf(time.startsAt, timezone),
                })
              }
              className="items-center justify-center rounded-xl border border-border px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-label leading-5 font-medium">
                {timeOfDay(time.startsAt, timezone)}
              </Text>
              <Text className="text-[11px] leading-[14px] text-unit">
                {groundsText(time.grounds, card.sports)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});

// A game needing players: when, the ground and the venue, the spots, how many are left.
export function RailGameCard({ game }: { game: Game }) {
  const { t } = useTranslation();
  const { timezone } = game;
  const left = game.spotsLeft;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => push({ pathname: "/game/[id]", params: { id: game.id } })}
      className="rounded-2xl border border-border bg-white p-4 active:opacity-70"
    >
      <Text className="text-[18px] leading-6 font-semibold" numberOfLines={1}>
        {t("screens.home.gameWhen", {
          day: whenDay(game.startsAt, timezone),
          time: timeOfDay(game.startsAt, timezone),
        })}
      </Text>
      <Text className="pt-0.5 text-caption leading-[18px] text-ink-2" numberOfLines={1}>
        {[kindOf(game.ground), game.venue.name ?? ""].filter(Boolean).join(" · ")}
      </Text>
      <View className="mt-3 flex-row items-center justify-between gap-3">
        <View className="shrink">
          <SpotsRow
            booker={game.booker.firstName}
            joined={game.playerCount}
            names={null}
            open={left}
            max={5}
          />
        </View>
        <Text className="text-label leading-5 font-medium">
          {t("screens.home.left", { count: left })}
        </Text>
      </View>
    </Pressable>
  );
}

// The black ticket: your next game, big, then a tear with a notch at each edge, then when check-in
// opens and My code (lime, the big moment).
export function NextGameTicket({
  day,
  range,
  place,
  checkInFrom,
  onOpen,
  onCode,
}: {
  day: string;
  range: string;
  place: string;
  checkInFrom: string | null;
  onOpen: () => void;
  onCode: (() => void) | null;
}) {
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} className="active:opacity-90">
      <View className="rounded-[20px] bg-ink">
        <View className="px-[18px] pt-[18px] pb-4">
          <Text className="text-caption leading-[18px] text-white/60">
            {t("screens.home.nextGame")}
          </Text>
          <Text className="pt-1 text-[22px] leading-7 font-semibold text-white">
            {t("formats.moment", { day, time: range })}
          </Text>
          <Text className="pt-1 text-label leading-5 text-white/60" numberOfLines={1}>
            {place}
          </Text>
        </View>
        {/* The tear: a dashed line, and a notch cut into each edge (the page's white). */}
        <View className="justify-center" style={{ height: 1 }}>
          <View className="mx-[18px] border-t border-dashed border-white/30" />
          <View className="absolute -left-[9px] size-[18px] rounded-full bg-white" />
          <View className="absolute -right-[9px] size-[18px] rounded-full bg-white" />
        </View>
        <View className="min-h-[60px] flex-row items-center justify-between gap-3 px-[18px] py-3">
          <Text className="shrink text-label leading-5 text-white/60">
            {checkInFrom ? t("screens.home.checkInFrom", { time: checkInFrom }) : ""}
          </Text>
          {onCode ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCode}
              className="h-9 flex-row items-center gap-1.5 rounded-full bg-primary px-3.5 active:opacity-80"
            >
              <IconQrcode size={17} color={colors.ink} strokeWidth={2} />
              <Text className="text-label leading-5 font-semibold text-on-primary">
                {t("screens.home.myCode")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
