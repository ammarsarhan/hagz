import { playersOn, refundBands, shareOf, type CancellationTier } from "@hagz/contracts";
import type { components } from "@hagz/api";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, TextInput, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { FieldBox, inputClass } from "@/components/field";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconMinus, IconPlus } from "@/components/icons";
import { BackButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { useSignInSheet } from "@/components/sign-in-sheet";
import { Text } from "@/components/text";
import { GroupHeading, Hairline } from "@/components/venue-sections";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import {
  dayLabel,
  hoursLabel,
  kindOf,
  momentLabel,
  timeOfDay,
  timeRange,
  type PublicGround,
  type PublicVenue,
} from "@/lib/venue";

// Review and book (Figma C8 round 2, 251:2, and 252:2 with players on): the booking's last step.
// What's being booked, its price as the API quotes it (POST /v1/bookings/quote: a line an hour and
// one per extra, so it's exactly what booking will charge), Need players? (an open game asked for
// at checkout, which opens once the booking is confirmed), and the cancellation tiers as real
// deadlines counted back from kick-off. Book is lime: one of the few big moments.

type Quote = components["schemas"]["BookingQuote"];

// The back button's row and its gap to the title, as on See times, and the bar's 8 under it.
const ROW = 40;
const TITLE_GAP = 22;
const BAR_BELOW = 8;
// Players asked for to begin with (Figma 252:2), never more than the ground takes.
const FIRST_ASK = 3;
const HOUR = 3_600_000;

type Loaded =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; venue: PublicVenue; quote: Quote };

export default function Review() {
  // From Extras (or See times, at a venue with no extras): the hours picked and the extras ticked.
  const params = useLocalSearchParams<{
    slug: string;
    ground: string;
    date: string;
    startsAt: string;
    endsAt: string;
    amenities?: string;
  }>();
  const amenities = params.amenities ? params.amenities.split(",") : [];
  const amenityKey = params.amenities ?? "";
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

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
            amenities: amenityKey ? amenityKey.split(",") : [],
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
  }, [params.slug, params.ground, params.startsAt, params.endsAt, amenityKey, attempt]);

  if (loaded.state === "loading") return <PageState loading />;
  if (loaded.state === "failed") {
    return <PageState message={loaded.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  const ground = loaded.venue.grounds.find((each) => each.id === params.ground);
  if (!ground) return <PageState message="" />;
  return (
    <Content
      venue={loaded.venue}
      ground={ground}
      quote={loaded.quote}
      date={params.date}
      startsAt={params.startsAt}
      endsAt={params.endsAt}
      amenities={amenities}
      from={{ pathname: "/venue/[slug]/review", params }}
    />
  );
}

// The cancellation tiers as rows: until when each refund lasts, counted back from kick-off at the
// venue's clock, and how much comes back. Windows that have already closed are left out.
const cancelRows = (
  tiers: CancellationTier[],
  startsAt: string,
  timezone: string,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  const start = Date.parse(startsAt);
  const before = (hours: number) => new Date(start - hours * HOUR).toISOString();
  const back = (percent: number) =>
    percent === 100
      ? t("screens.review.cancel.everything")
      : percent === 50
        ? t("screens.review.cancel.half")
        : percent === 0
          ? t("screens.review.cancel.nothing")
          : t("screens.review.cancel.percent", { percent });
  return refundBands(tiers)
    .filter((band) => band.from === 0 || start - band.from * HOUR > Date.now())
    .map((band) => ({
      key: band.from,
      when:
        band.from > 0
          ? t("screens.review.cancel.until", { moment: momentLabel(before(band.from), timezone) })
          : band.to === null
            ? t("screens.review.cancel.always")
            : t("screens.review.cancel.after", { moment: momentLabel(before(band.to), timezone) }),
      line:
        band.from > 0
          ? t("screens.review.cancel.orMore", { hours: hoursLabel(band.from) })
          : band.to === null
            ? null
            : t("screens.review.cancel.lessThan", { hours: hoursLabel(band.to) }),
      back: back(band.refundPercent),
    }));
};

function Content({
  venue,
  ground,
  quote,
  date,
  startsAt,
  endsAt,
  amenities,
  from,
}: {
  venue: PublicVenue;
  ground: PublicGround;
  quote: Quote;
  date: string;
  startsAt: string;
  endsAt: string;
  amenities: string[];
  // This screen, for signing in to come back to.
  from: Parameters<typeof useSignInSheet>[0];
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const { whenSignedIn, sheet } = useSignInSheet(from);
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer);

  const { currency, timezone } = venue.marketplace;
  const venueName = venue.name ?? "";
  const groundName = ground.name ?? kindOf(ground);
  const most = playersOn(ground.sport, ground.size) - 1;
  const share = shareOf(quote.total, playersOn(ground.sport, ground.size));

  const [players, setPlayers] = useState(false);
  const [needed, setNeeded] = useState(Math.min(FIRST_ASK, most));
  const [note, setNote] = useState("");
  const [focused, setFocused] = useState(false);
  const [booking, setBooking] = useState(false);

  const cancellation = venue.booking.cancellation;
  const rows = cancellation ? cancelRows(cancellation.tiers, startsAt, timezone, t) : [];
  const mode = quote.paymentMode;
  const deposit = formatPrice(quote.deposit ?? 0, currency);

  // One key per booking as asked: a retry of the same one replays it, a changed one is new.
  const key = useRef<{ body: string; value: string } | null>(null);
  const book = async () => {
    const body = {
      groundId: ground.id,
      startsAt,
      endsAt,
      amenities,
      ...(players
        ? { listing: { neededPlayers: needed, ...(note.trim() ? { note: note.trim() } : {}) } }
        : {}),
    };
    const asJson = JSON.stringify(body);
    if (key.current?.body !== asJson) key.current = { body: asJson, value: newIdempotencyKey() };
    setBooking(true);
    const result = await send(
      api.POST("/v1/bookings", {
        params: { header: { "idempotency-key": key.current.value } },
        body,
      }),
    );
    setBooking(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    // The Sent and Booked screens (C8 260:2, 261:2) come next; until they're built, back to the
    // venue with a word on how it went.
    router.dismissTo({ pathname: "/venue/[slug]", params: { slug: venue.slug } });
    hud.show(
      result.data.status === "PENDING"
        ? t("screens.review.sent", { venue: venueName })
        : t("screens.review.booked"),
    );
  };

  const onBook = () => {
    // Paying online (deposit or in full) comes with Phase 5; a booking now would only wait for a
    // payment that can't be made.
    if (mode !== "MANUAL") {
      hud.show(t("screens.review.payOnlineSoon"));
      return;
    }
    void whenSignedIn(() => void book(), {
      title: t("screens.review.signIn.title"),
      body: t("screens.review.signIn.body", { ground: groundName, venue: venueName }),
    });
  };

  // A long page scrolls under the back button's bar, a hairline showing once it does.
  const bar = insets.top + ROW + BAR_BELOW;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const hairline = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], "clamp"),
  }));

  const cover = venue.photos[0]?.url;
  const where = [kindOf(ground), venue.location.area].filter(Boolean).join(" · ");

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
          {t("screens.review.title")}
        </Text>

        {/* What's being booked: the venue's cover, the ground and venue, when, and what kind. */}
        <View className="mt-5 flex-row items-center gap-3.5">
          {cover ? (
            <Image source={{ uri: cover }} style={{ width: 64, height: 64, borderRadius: 12 }} />
          ) : (
            <View className="size-16 rounded-[12px] bg-chip" />
          )}
          <View className="flex-1 gap-0.5">
            <Text className="text-subtitle font-medium" numberOfLines={1}>
              {venueName ? `${groundName} · ${venueName}` : groundName}
            </Text>
            <Text className="text-label text-ink-2" numberOfLines={1}>
              {t("screens.times.line", {
                day: dayLabel(date),
                range: timeRange(startsAt, endsAt, timezone),
              })}
            </Text>
            <Text className="text-label text-ink-2" numberOfLines={1}>
              {where}
            </Text>
          </View>
        </View>

        <View className="mt-[22px] mb-5">
          <Hairline />
        </View>

        {/* The quote: a line an hour, one per extra, the total, and how it's paid. */}
        <View className="gap-2">
          <View className="pb-1.5">
            <GroupHeading>{t("screens.review.price")}</GroupHeading>
          </View>
          {quote.charges.map((charge, index) => (
            <View key={index} className="flex-row justify-between gap-4">
              <Text className="shrink text-body leading-[22px] text-ink-2">
                {charge.type === "SLOT" && charge.startsAt
                  ? timeOfDay(charge.startsAt, timezone)
                  : (charge.amenity?.name ?? "")}
              </Text>
              <Text className="text-body leading-[22px]">
                {formatPrice(charge.amount, currency)}
              </Text>
            </View>
          ))}
          <View className="py-1.5">
            <Hairline />
          </View>
          <View className="flex-row justify-between gap-4">
            <Text className="text-body leading-[22px] font-semibold">
              {t("screens.review.total")}
            </Text>
            <Text className="text-body leading-[22px] font-semibold">
              {formatPrice(quote.total, currency)}
            </Text>
          </View>
          <Text className="text-caption text-unit">
            {[
              quote.tax > 0 ? t("screens.review.vatIncluded") : "",
              t(`screens.review.pay.${mode}`, { deposit }),
            ]
              .filter(Boolean)
              .join(" ")}
          </Text>
        </View>

        <View className="mt-[22px] mb-5">
          <Hairline />
        </View>

        {/* Need players?: on, how many (each pays the booker their share) and a note. */}
        <View>
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-subtitle font-medium">{t("screens.review.players.title")}</Text>
              <Text className="text-label text-ink-2">{t("screens.review.players.body")}</Text>
            </View>
            <Switch
              value={players}
              onValueChange={setPlayers}
              trackColor={{ false: "#e9e9eb", true: colors.ink }}
              ios_backgroundColor="#e9e9eb"
              accessibilityLabel={t("screens.review.players.title")}
            />
          </View>
          {players ? (
            <>
              <View className="flex-row items-center justify-between pt-4">
                <View className="gap-0.5">
                  <Text className="text-subtitle font-medium">
                    {t("screens.review.players.count", { count: needed })}
                  </Text>
                  <Text className="text-label text-ink-2">
                    {t("screens.review.players.each", {
                      share: formatPrice(share, currency),
                      max: most,
                    })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-3.5">
                  <StepButton
                    icon="minus"
                    label={t("screens.review.players.less")}
                    disabled={needed <= 1}
                    onPress={() => setNeeded((n) => Math.max(1, n - 1))}
                  />
                  <StepButton
                    icon="plus"
                    label={t("screens.review.players.more")}
                    disabled={needed >= most}
                    onPress={() => setNeeded((n) => Math.min(most, n + 1))}
                  />
                </View>
              </View>
              <View className="pt-3">
                <FieldBox focused={focused} error={false}>
                  <TextInput
                    className={inputClass}
                    value={note}
                    onChangeText={setNote}
                    maxLength={300}
                    placeholder={t("screens.review.players.note")}
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
                  ? t("screens.review.players.whenPending", { venue: venueName })
                  : quote.startsAs === "HELD"
                    ? t("screens.review.players.whenHeld")
                    : t("screens.review.players.whenConfirmed")}
              </Text>
            </>
          ) : null}
        </View>

        {rows.length > 0 ? (
          <>
            <View className="mt-[22px] mb-5">
              <Hairline />
            </View>
            {/* If you cancel: each refund's deadline, counted back from kick-off. */}
            <View>
              <View className="pb-1.5">
                <GroupHeading>{t("screens.review.cancel.title")}</GroupHeading>
              </View>
              {rows.map((row, index) => (
                <View
                  key={row.key}
                  className={`flex-row items-start justify-between gap-4 py-2.5 ${index < rows.length - 1 ? "border-b border-border" : ""}`}
                >
                  <View className="shrink gap-0.5">
                    <Text className="text-body font-medium">{row.when}</Text>
                    {row.line ? <Text className="text-caption text-unit">{row.line}</Text> : null}
                  </View>
                  <Text className="text-body">{row.back}</Text>
                </View>
              ))}
            </View>
          </>
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

      {/* The total, how it's paid, and Book. */}
      <View
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-6 border-t border-border bg-white px-6 pt-3.5"
        style={{ paddingBottom: insets.bottom + 8 }}
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
      >
        <View className="shrink gap-0.5">
          <Text className="text-button font-medium">{formatPrice(quote.total, currency)}</Text>
          <Text className="text-caption text-unit" numberOfLines={1}>
            {t(`screens.review.footer.${mode}`, { deposit })}
          </Text>
        </View>
        <View className="w-[150px]">
          <Button
            label={t("screens.review.book")}
            variant="moment"
            size="small"
            loading={booking}
            onPress={onBook}
          />
        </View>
      </View>
      {sheet}
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
