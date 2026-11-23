import { playersOn, shareOf } from "@hagz/contracts";
import type { components } from "@hagz/api";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CancelSection, PriceSection, SectionBreak } from "@/components/booking-sections";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { BackButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { useSignInSheet } from "@/components/sign-in-sheet";
import { Text } from "@/components/text";
import { GroupHeading } from "@/components/venue-sections";
import { api, reachable } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { rememberBooking } from "@/lib/just-booked";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import { dayLabel, kindOf, timeRange, type PublicGround, type PublicVenue } from "@/lib/venue";

// Review and book (Figma C8 round 2, 251:2): the booking's last step, a summary to check before
// booking, with nothing left to choose (Need players? moved to Anything else?, user 2026-11-23).
// What's being booked; its price as the API quotes it (POST /v1/bookings/quote: a line an hour, one
// per extra and Hagz's service fee, so it's exactly what booking will charge); the open game asked
// for, if any; and the cancellation tiers as real deadlines counted back from kick-off. Book is
// lime: one of the few big moments.

type Quote = components["schemas"]["BookingQuote"];

// The back button's row and its gap to the title, as on See times, and the bar's 8 under it.
const ROW = 40;
const TITLE_GAP = 22;
const BAR_BELOW = 8;

type Loaded =
  | { state: "loading" }
  | { state: "failed"; error: unknown }
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
    // The open game asked for: how many players, and the note.
    players?: string;
    note?: string;
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
      if (!venue.ok) setLoaded({ state: "failed", error: venue.error });
      else if (!quote.ok) setLoaded({ state: "failed", error: quote.error });
      else setLoaded({ state: "ready", venue: venue.data, quote: quote.data });
    });
    return () => {
      active = false;
    };
  }, [params.slug, params.ground, params.startsAt, params.endsAt, amenityKey, attempt]);

  if (loaded.state === "loading") return <PageState loading />;
  if (loaded.state === "failed") {
    return <PageState error={loaded.error} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  const ground = loaded.venue.grounds.find((each) => each.id === params.ground);
  if (!ground) return <PageState />;
  return (
    <Content
      venue={loaded.venue}
      ground={ground}
      quote={loaded.quote}
      date={params.date}
      startsAt={params.startsAt}
      endsAt={params.endsAt}
      amenities={amenities}
      game={
        params.players
          ? { players: Number(params.players), note: params.note ? params.note : null }
          : null
      }
      from={{ pathname: "/venue/[slug]/review", params }}
    />
  );
}

function Content({
  venue,
  ground,
  quote,
  date,
  startsAt,
  endsAt,
  amenities,
  game,
  from,
}: {
  venue: PublicVenue;
  ground: PublicGround;
  quote: Quote;
  date: string;
  startsAt: string;
  endsAt: string;
  amenities: string[];
  // The open game asked for on Anything else?, if any.
  game: { players: number; note: string | null } | null;
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
  const share = shareOf(quote.total, playersOn(ground.sport, ground.size));
  const [booking, setBooking] = useState(false);

  const cancellation = venue.booking.cancellation;
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
      ...(game
        ? { listing: { neededPlayers: game.players, ...(game.note ? { note: game.note } : {}) } }
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
    // Sent or Booked next, in this screen's place: the booking's made, so there's no coming back.
    rememberBooking(result.data, venue);
    router.replace({ pathname: "/booked/[id]", params: { id: result.data.id } });
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
            <Image
              source={{ uri: reachable(cover) }}
              style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: "#c4c8cf" }}
              contentFit="cover"
              transition={150}
            />
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

        <SectionBreak />

        {/* The quote: a line an hour, one per extra, the total, and how it's paid. */}
        <PriceSection
          charges={quote.charges}
          endsAt={endsAt}
          total={quote.total}
          currency={currency}
          timezone={timezone}
          note={[
            quote.tax > 0 ? t("screens.review.vatIncluded") : "",
            t(`screens.review.pay.${mode}`, { deposit }),
          ]
            .filter(Boolean)
            .join(" ")}
        />

        {/* The open game asked for on Anything else?, if any: how many, each one's share, the note. */}
        {game ? (
          <>
            <SectionBreak />
            <View className="gap-2">
              <View className="pb-1.5">
                <GroupHeading>{t("screens.review.game.title")}</GroupHeading>
              </View>
              <View className="flex-row justify-between gap-4">
                <Text className="shrink text-body leading-[22px] text-ink-2">
                  {t("screens.review.game.wanted")}
                </Text>
                <Text className="text-body leading-[22px]">
                  {t("screens.extras.players.count", { count: game.players })}
                </Text>
              </View>
              <View className="flex-row justify-between gap-4">
                <Text className="shrink text-body leading-[22px] text-ink-2">
                  {t("screens.review.game.each")}
                </Text>
                <Text className="text-body leading-[22px]">{formatPrice(share, currency)}</Text>
              </View>
              {game.note ? (
                <Text className="text-body leading-[22px] text-ink-2">{`“${game.note}”`}</Text>
              ) : null}
              <Text className="text-caption text-unit">
                {quote.startsAs === "PENDING"
                  ? t("screens.extras.players.whenPending", { venue: venueName })
                  : quote.startsAs === "HELD"
                    ? t("screens.extras.players.whenHeld")
                    : t("screens.extras.players.whenConfirmed")}
              </Text>
            </View>
          </>
        ) : null}

        {cancellation ? (
          <CancelSection tiers={cancellation.tiers} startsAt={startsAt} timezone={timezone} />
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
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-6 border-t border-border bg-white pt-3.5"
        // The button closer to the edge than the price, as on the venue page's Book bar.
        style={{ paddingStart: 24, paddingEnd: 16, paddingBottom: insets.bottom + 8 }}
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
