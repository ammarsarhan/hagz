import { playersOn, shareOf } from "@hagz/contracts";
import type { components } from "@hagz/api";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { FieldBox, inputClass } from "@/components/field";
import { useHudAnchor } from "@/components/hud";
import { IconCheck, IconMinus, IconPlus } from "@/components/icons";
import { BackButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { Text } from "@/components/text";
import { Toggle } from "@/components/toggle";
import { Hairline } from "@/components/venue-sections";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL, language } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import {
  dayLabel,
  listText,
  timeRange,
  type PublicAmenity,
  type PublicGround,
  type PublicVenue,
} from "@/lib/venue";

// Anything else? (Figma C8 round 2, 250:2, with 252:2's Need players? moved here by the user,
// 2026-11-23): the booking's second step, after See times. The venue's priced amenities as rows to
// tick, each paid with the booking: per booking once, per hour for every hour picked (as the API
// prices them, bookings/domain/charges.ts); the free ones named under the list as included. Then
// Need players?: an open game asked for at checkout, how many and a note, which opens once the
// booking is confirmed. Every venue shows this step, as anyone can ask for players.
//
// The bar keeps the total as booking will charge it: the hours, what's ticked and Hagz's service
// fee (read once from a quote, as it doesn't change with the extras), so each player's share under
// the stepper is the server's own (shareOf in contracts).

type Quote = components["schemas"]["BookingQuote"];

// The back button's row and its gap to the title, as on See times, and the bar's 8 under it.
const ROW = 40;
const TITLE_GAP = 22;
const BAR_BELOW = 8;
// Players asked for to begin with (Figma 252:2), never more than the ground takes.
const FIRST_ASK = 3;

type Loaded =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; venue: PublicVenue; quote: Quote };

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
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  // The venue, and a quote for the hours alone: its service fee, and what booking would start as.
  useEffect(() => {
    let active = true;
    setLoaded({ state: "loading" });
    void Promise.all([
      send(api.GET("/v1/venues/{slug}", { params: { path: { slug: params.slug } } })),
      send(
        api.POST("/v1/bookings/quote", {
          body: {
            groundId: params.ground,
            startsAt: params.startsAt,
            endsAt: params.endsAt,
            amenities: [],
          },
        }),
      ),
    ]).then(([venue, quote]) => {
      if (!active) return;
      if (!venue.ok) setLoaded({ state: "failed", message: hudMessage(venue.error) });
      else if (!quote.ok) setLoaded({ state: "failed", message: hudMessage(quote.error) });
      else setLoaded({ state: "ready", venue: venue.data, quote: quote.data });
    });
    return () => {
      active = false;
    };
  }, [params.slug, params.ground, params.startsAt, params.endsAt, attempt]);

  if (loaded.state === "loading") return <PageState loading />;
  if (loaded.state === "failed") {
    return <PageState message={loaded.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  const ground = loaded.venue.grounds.find((each) => each.id === params.ground);
  if (!ground) return <PageState message="" />;
  return (
    <Picker
      venue={loaded.venue}
      ground={ground}
      quote={loaded.quote}
      booking={{
        slug: params.slug,
        ground: params.ground,
        date: params.date,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
      }}
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
  ground,
  quote,
  booking,
  date,
  startsAt,
  endsAt,
  slots,
  price,
}: {
  venue: PublicVenue;
  ground: PublicGround;
  // The hours alone, quoted: the service fee and what booking would start as.
  quote: Quote;
  // What See times handed over, passed on to Review.
  booking: { slug: string; ground: string; date: string; startsAt: string; endsAt: string };
  date: string;
  startsAt: string;
  endsAt: string;
  // How many hours were picked, and what they come to.
  slots: number;
  price: number;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const most = playersOn(ground.sport, ground.size) - 1;
  const [players, setPlayers] = useState(false);
  const [needed, setNeeded] = useState(Math.min(FIRST_ASK, most));
  const [note, setNote] = useState("");
  const [focused, setFocused] = useState(false);
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer);

  const { currency, timezone } = venue.marketplace;
  const priced = venue.amenities.filter((amenity) => amenity.price !== null);
  const free = venue.amenities.filter((amenity) => amenity.price === null);
  const included = includedLine(free, t);

  const cost = (amenity: PublicAmenity) =>
    (amenity.price ?? 0) * (amenity.pricing === "PER_HOUR" ? slots : 1);
  // Hagz's service fee: the same whatever's ticked (players × hours), so the hours' quote has it.
  const fee = quote.charges
    .filter((charge) => charge.type === "SERVICE_FEE")
    .reduce((sum, charge) => sum + charge.amount, 0);
  const total =
    price +
    fee +
    priced.filter((amenity) => ticked.has(amenity.id)).reduce((sum, a) => sum + cost(a), 0);
  const share = shareOf(total, playersOn(ground.sport, ground.size));
  const venueName = venue.name ?? "";

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
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: insets.top + ROW + TITLE_GAP,
          paddingHorizontal: 24,
          paddingBottom: footer + 32,
        }}
      >
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {t("screens.extras.title")}
        </Text>
        {priced.length > 0 ? (
          <Text className="mt-1.5 text-body text-ink-2">
            {venue.name
              ? t("screens.extras.subtitle", { venue: venue.name })
              : t("screens.extras.subtitleNoName")}
          </Text>
        ) : null}

        <View className={priced.length > 0 ? "mt-4" : ""}>
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

        {priced.length > 0 || included ? (
          <View className="mt-[22px] mb-5">
            <Hairline />
          </View>
        ) : (
          <View className="h-5" />
        )}

        {/* Need players?: on, how many (each pays the booker their share) and a note. */}
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-subtitle font-medium">{t("screens.extras.players.title")}</Text>
            <Text className="text-label text-ink-2">{t("screens.extras.players.body")}</Text>
          </View>
          <Toggle value={players} onChange={setPlayers} label={t("screens.extras.players.title")} />
        </View>
        {players ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(220)}
          >
            <View className="flex-row items-center justify-between pt-6">
              <View className="gap-0.5">
                <Text className="text-subtitle font-medium">
                  {t("screens.extras.players.count", { count: needed })}
                </Text>
                <Text className="text-label text-ink-2">
                  {t("screens.extras.players.each", {
                    share: formatPrice(share, currency),
                    max: most,
                  })}
                </Text>
              </View>
              <View className="flex-row items-center gap-3.5">
                <StepButton
                  icon="minus"
                  label={t("screens.extras.players.less")}
                  disabled={needed <= 1}
                  onPress={() => setNeeded((n) => Math.max(1, n - 1))}
                />
                <StepButton
                  icon="plus"
                  label={t("screens.extras.players.more")}
                  disabled={needed >= most}
                  onPress={() => setNeeded((n) => Math.min(most, n + 1))}
                />
              </View>
            </View>
            <View className="pt-5">
              <FieldBox focused={focused} error={false}>
                <TextInput
                  className={inputClass}
                  value={note}
                  onChangeText={setNote}
                  maxLength={300}
                  placeholder={t("screens.extras.players.note")}
                  placeholderTextColor={colors.ink3}
                  selectionColor={colors.ink}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  returnKeyType="done"
                />
              </FieldBox>
            </View>
            <Text className="pt-2.5 text-caption text-unit">
              {quote.startsAs === "PENDING"
                ? t("screens.extras.players.whenPending", { venue: venueName })
                : quote.startsAs === "HELD"
                  ? t("screens.extras.players.whenHeld")
                  : t("screens.extras.players.whenConfirmed")}
            </Text>
          </Animated.View>
        ) : null}
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
            onPress={() =>
              router.push({
                pathname: "/venue/[slug]/review",
                params: {
                  ...booking,
                  amenities: priced
                    .filter((amenity) => ticked.has(amenity.id))
                    .map((amenity) => amenity.id)
                    .join(","),
                  // The open game asked for, if any: how many players and the note.
                  ...(players
                    ? { players: String(needed), ...(note.trim() ? { note: note.trim() } : {}) }
                    : {}),
                },
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

// The players stepper's grey round − and + (36, an 18 icon); faded at the end of its range.
function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const Glyph = icon === "minus" ? IconMinus : IconPlus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className="size-9 items-center justify-center rounded-full bg-chip active:opacity-70"
    >
      <Glyph size={18} color={disabled ? colors.ink3 : colors.ink} strokeWidth={2} />
    </Pressable>
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
