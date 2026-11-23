import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconCheck } from "@/components/icons";
import { BackButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL, language } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import { dayLabel, listText, timeRange, type PublicAmenity, type PublicVenue } from "@/lib/venue";

// Extras (Figma C8 round 2, 250:2): the booking's second step, after See times and skipped when
// the venue prices nothing. The venue's priced amenities as rows to tick, each paid with the
// booking: per booking once, per hour for every hour picked (as the API prices them,
// bookings/domain/charges.ts). The free ones are named under the list as included. The bar keeps
// the total, the hours' prices and what's ticked, and the day and time.

// The back button's row and its gap to the title, as on See times, and the bar's 8 under it.
const ROW = 40;
const TITLE_GAP = 22;
const BAR_BELOW = 8;

type Loaded<T> =
  { state: "loading" } | { state: "failed"; message: string } | { state: "ready"; data: T };

export default function Extras() {
  // From See times: the venue, the ground, the day it was picked on, the hours and their price.
  const params = useLocalSearchParams<{
    slug: string;
    ground: string;
    date: string;
    startsAt: string;
    endsAt: string;
    slots: string;
    price: string;
  }>();
  const [venue, setVenue] = useState<Loaded<PublicVenue>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void send(api.GET("/v1/venues/{slug}", { params: { path: { slug: params.slug } } })).then(
      (result) => {
        if (!active) return;
        setVenue(
          result.ok
            ? { state: "ready", data: result.data }
            : { state: "failed", message: hudMessage(result.error) },
        );
      },
    );
    return () => {
      active = false;
    };
  }, [params.slug, attempt]);

  if (venue.state === "loading") return <PageState loading />;
  if (venue.state === "failed") {
    return <PageState message={venue.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  return (
    <Picker
      venue={venue.data}
      date={params.date}
      startsAt={params.startsAt}
      endsAt={params.endsAt}
      slots={Number(params.slots)}
      price={Number(params.price)}
    />
  );
}

// An amenity's name inside a sentence: "changing rooms" after a comma, but "Wi-Fi" and "CCTV" as
// they are (a capital past the first letter of the first word means it's written that way on
// purpose). Arabic has no capitals.
const midSentence = (name: string) => {
  if (language !== "en") return name;
  const word = name.split(" ")[0] ?? "";
  return word.slice(1) === word.slice(1).toLowerCase()
    ? `${name.charAt(0).toLowerCase()}${name.slice(1)}`
    : name;
};

// "Floodlights, changing rooms and parking are included."
const includedLine = (free: PublicAmenity[], t: ReturnType<typeof useTranslation>["t"]) => {
  const names = free.map((amenity) => amenity.name).filter((name): name is string => !!name);
  if (names.length === 0) return null;
  const list = listText(names.map((name, index) => (index === 0 ? name : midSentence(name))));
  return t("screens.extras.included", { list, count: names.length });
};

function Picker({
  venue,
  date,
  startsAt,
  endsAt,
  slots,
  price,
}: {
  venue: PublicVenue;
  date: string;
  startsAt: string;
  endsAt: string;
  // How many hours were picked, and what they come to.
  slots: number;
  price: number;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer);

  const { currency, timezone } = venue.marketplace;
  const priced = venue.amenities.filter((amenity) => amenity.price !== null);
  const free = venue.amenities.filter((amenity) => amenity.price === null);
  const included = includedLine(free, t);

  const cost = (amenity: PublicAmenity) =>
    (amenity.price ?? 0) * (amenity.pricing === "PER_HOUR" ? slots : 1);
  const total =
    price + priced.filter((amenity) => ticked.has(amenity.id)).reduce((sum, a) => sum + cost(a), 0);

  const toggle = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // A long list scrolls under the back button's bar, a hairline showing once it does.
  const bar = insets.top + ROW + BAR_BELOW;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const hairline = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], "clamp"),
  }));

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + ROW + TITLE_GAP,
          paddingHorizontal: 24,
          paddingBottom: footer + 32,
        }}
      >
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {t("screens.extras.title")}
        </Text>
        <Text className="mt-1.5 text-body text-ink-2">
          {venue.name
            ? t("screens.extras.subtitle", { venue: venue.name })
            : t("screens.extras.subtitleNoName")}
        </Text>

        <View className="mt-4">
          {priced.map((amenity, index) => (
            <ExtraRow
              key={amenity.id}
              name={amenity.name ?? amenity.key}
              price={t(
                amenity.pricing === "PER_HOUR"
                  ? "screens.extras.perHour"
                  : "screens.extras.perBooking",
                { price: formatPrice(amenity.price ?? 0, currency) },
              )}
              ticked={ticked.has(amenity.id)}
              last={index === priced.length - 1}
              onPress={() => toggle(amenity.id)}
            />
          ))}
        </View>

        {included ? <Text className="mt-2.5 text-label text-ink-2">{included}</Text> : null}
      </Animated.ScrollView>

      {/* The fixed bar: the back button. */}
      <View
        className="absolute top-0 right-0 left-0 bg-white px-5"
        style={{ height: bar, paddingTop: insets.top }}
      >
        <View className="-mx-1 h-10 flex-row items-center">
          <BackButton onPress={() => router.back()} />
        </View>
        <Animated.View
          className="absolute right-0 bottom-0 left-0 h-px bg-hairline"
          style={hairline}
        />
      </View>

      {/* The total with what's ticked, the day and time, and Continue. */}
      <View
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-6 border-t border-border bg-white px-6 pt-3.5"
        style={{ paddingBottom: insets.bottom + 8 }}
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
      >
        <View className="shrink gap-0.5">
          <Text className="text-button font-medium">{formatPrice(total, currency)}</Text>
          <Text className="text-caption text-unit" numberOfLines={1}>
            {t("screens.times.line", {
              day: dayLabel(date),
              range: timeRange(startsAt, endsAt, timezone),
            })}
          </Text>
        </View>
        <View className="w-[150px]">
          <Button
            label={t("screens.extras.continue")}
            size="small"
            // Review and book (C8 251:2) comes next; until it's built, booking opens soon.
            onPress={() => hud.show(t("screens.venue.bookingSoon"))}
          />
        </View>
      </View>
    </View>
  );
}

// An extra to tick: the box, then its name over its price. Ticked, the box's black (with a white
// check) fades in over the empty one.
function ExtraRow({
  name,
  price,
  ticked,
  last,
  onPress,
}: {
  name: string;
  price: string;
  ticked: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const shown = useSharedValue(ticked ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(ticked ? 1 : 0, { duration: 140 });
  }, [ticked, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ticked }}
      accessibilityLabel={`${name}, ${price}`}
      onPress={onPress}
      className={`flex-row items-center gap-4 py-3.5 active:opacity-70 ${last ? "" : "border-b border-border"}`}
    >
      <View className="size-6 rounded-[7px] border border-[#c4c8cf]">
        <Animated.View
          pointerEvents="none"
          className="absolute -inset-px items-center justify-center rounded-[7px] bg-ink"
          style={fill}
        >
          <IconCheck size={16} color={colors.white} strokeWidth={2.5} />
        </Animated.View>
      </View>
      <View className="flex-1">
        <Text className="text-body leading-5 font-medium">{name}</Text>
        <Text className="pt-0.5 text-caption leading-[18px] text-ink-2">{price}</Text>
      </View>
    </Pressable>
  );
}
