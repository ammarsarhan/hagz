import type { components } from "@hagz/api";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, Share, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CancelSection, PriceSection, SectionBreak } from "@/components/booking-sections";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import {
  IconChevronRight,
  IconDirections,
  IconPhone,
  IconQrcode,
  IconShare,
} from "@/components/icons";
import { BackButton, RoundButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { Text } from "@/components/text";
import { GroupHeading, openDirections, VenueMap } from "@/components/venue-sections";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { webLinks } from "@/lib/links";
import { push } from "@/lib/navigation";
import { formatPrice } from "@/lib/money";
import {
  dayLabel,
  deadlineLabel,
  kindOf,
  listText,
  localDateOf,
  timeOfDay,
  timeRange,
} from "@/lib/venue";

// A player's booking (Figma C8 "Booking · Confirmed", 256:2), opened from the Bookings tab or
// View booking: when and where as the title, a grey card on where it stands (Check in at the desk
// with Show my code, once confirmed), its open game, Getting there (the map, the address, call and
// directions), the price, what comes back if they cancel, and the booking code. Read with the
// booking, so it opens even once the venue has stopped being public.

type Booking = components["schemas"]["Booking"];
type Loaded =
  { state: "loading" } | { state: "failed"; error: unknown } | { state: "ready"; booking: Booking };

const ROW = 40;
const TITLE_GAP = 22;
const BAR_BELOW = 8;
const STILL_TO_PLAY = ["PENDING", "HELD", "UNCONFIRMED", "CONFIRMED"];

export default function BookingPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Read each time it's shown (back from checking in, a move answered elsewhere). What's on screen
  // stays while it reloads, and stays if that fails.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void send(api.GET("/v1/bookings/{bookingId}", { params: { path: { bookingId: id } } })).then(
        (result) => {
          if (!active) return;
          setLoaded((now) =>
            result.ok
              ? { state: "ready", booking: result.data }
              : now.state === "ready"
                ? now
                : { state: "failed", error: result.error },
          );
        },
      );
      return () => {
        active = false;
      };
    }, [id, attempt]),
  );

  if (loaded.state === "loading") return <PageState loading />;
  if (loaded.state === "failed") {
    return (
      <PageState
        error={loaded.error}
        onRetry={() => {
          setLoaded({ state: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <Content booking={loaded.booking} />;
}

function Content({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const { venue, currency } = booking;
  const { timezone } = venue;

  const venueName = venue.name ?? t("screens.venue.fallbackName");
  const groundName = booking.ground.name ?? kindOf(booking.ground);
  const day = dayLabel(localDateOf(booking.startsAt, timezone));
  const range = timeRange(booking.startsAt, booking.endsAt, timezone);
  const ended = Date.parse(booking.endsAt) <= Date.now();
  const live = STILL_TO_PLAY.includes(booking.status) && !ended;
  const link = webLinks?.sharedBooking(booking.code);

  const share = () => {
    if (!link) return;
    void Share.share({
      message: t("screens.booked.shareMessage", {
        ground: groundName,
        venue: venueName,
        when: `${day} · ${range}`,
        link,
      }),
    });
  };

  // A long page scrolls under the bar, a hairline showing once it does.
  const bar = insets.top + ROW + BAR_BELOW;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const hairline = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], "clamp"),
  }));

  const listing = booking.listing;
  const players = listing?.players.map((player) => player.firstName) ?? [];
  const place = venue.address ?? venue.area;

  const payNote = [
    booking.tax > 0 ? t("screens.review.vatIncluded") : "",
    t(`screens.booking.pay.${booking.paymentMode}`, {
      deposit: formatPrice(booking.deposit ?? 0, currency),
    }),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: bar - BAR_BELOW + TITLE_GAP,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* When, big, and what and where under it. */}
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {t("formats.moment", { day, time: range })}
        </Text>
        <Text className="mt-1 text-body leading-[23px] text-ink-2">
          {[groundName, kindOf(booking.ground), venueName].join(" · ")}
        </Text>

        <Standing booking={booking} venueName={venueName} ended={ended} />

        {/* Its open game: how many have joined, and who. */}
        {listing && live ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => hud.show(t("screens.booking.gameSoon"))}
            className="mt-[22px] flex-row items-center gap-3 active:opacity-70"
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-subtitle leading-[22px] font-medium">
                {t("screens.booking.game", {
                  joined: listing.playerCount,
                  needed: listing.neededPlayers,
                })}
              </Text>
              <Text className="text-label leading-5 text-ink-2" numberOfLines={1}>
                {players.length > 0
                  ? t("screens.booking.coming", {
                      count: players.length,
                      names: listText(players),
                    })
                  : t("screens.booking.noOneYet")}
              </Text>
            </View>
            <View style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}>
              <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.75} />
            </View>
          </Pressable>
        ) : null}

        <SectionBreak />

        {/* Getting there: the map, the venue and its address, call and directions. */}
        <View className="gap-1">
          <View className="pb-3">
            <GroupHeading>{t("screens.booking.gettingThere")}</GroupHeading>
          </View>
          {venue.coordinates ? (
            <VenueMap coordinates={venue.coordinates} height={160} radius={14} />
          ) : null}
          <View className="flex-row items-center justify-between gap-4 pt-[18px]">
            <View className="shrink gap-0.5">
              <Text className="text-subtitle leading-[22px] font-medium">{venueName}</Text>
              {place ? <Text className="text-label leading-5 text-ink-2">{place}</Text> : null}
            </View>
            <View className="flex-row gap-2.5">
              {venue.phone ? (
                <RoundButton
                  icon={IconPhone}
                  label={t("screens.booking.call")}
                  onPress={() => void Linking.openURL(`tel:${venue.phone}`)}
                />
              ) : null}
              {venue.coordinates ? (
                <RoundButton
                  icon={IconDirections}
                  label={t("screens.venue.directions")}
                  onPress={() =>
                    venue.coordinates &&
                    openDirections(
                      venue.coordinates.latitude,
                      venue.coordinates.longitude,
                      venueName,
                    )
                  }
                />
              ) : null}
            </View>
          </View>
        </View>

        <SectionBreak />

        <PriceSection
          charges={booking.charges}
          endsAt={booking.endsAt}
          total={booking.total}
          currency={currency}
          timezone={timezone}
          note={payNote}
        />

        {/* What comes back: only while there's still something to cancel. */}
        {live ? (
          <CancelSection
            tiers={booking.cancellation.tiers}
            startsAt={booking.startsAt}
            timezone={timezone}
          />
        ) : null}

        <SectionBreak />
        <View className="flex-row items-center justify-between">
          <Text className="text-caption leading-[18px] text-unit">{t("screens.booked.code")}</Text>
          <Text selectable className="text-subtitle font-semibold tracking-[1px]">
            {booking.code}
          </Text>
        </View>
      </Animated.ScrollView>

      {/* The fixed bar: back, and share. */}
      <View
        className="absolute top-0 right-0 left-0 bg-white px-5"
        style={{ height: bar, paddingTop: insets.top }}
      >
        <View className="-mx-1 h-10 flex-row items-center justify-between">
          <BackButton onPress={() => router.back()} />
          {link ? (
            <RoundButton icon={IconShare} label={t("screens.booked.share")} onPress={share} />
          ) : null}
        </View>
        <Animated.View
          className="absolute right-0 bottom-0 left-0 h-px bg-hairline"
          style={hairline}
        />
      </View>
    </View>
  );
}

// The grey card under the title: where the booking stands, and what to do about it. Confirmed and
// still to come, it's Check in at the desk with Show my code (Figma); every other state is the
// same card with a title and a line, no button.
function Standing({
  booking,
  venueName,
  ended,
}: {
  booking: Booking;
  venueName: string;
  ended: boolean;
}) {
  const { t } = useTranslation();
  const { timezone } = booking.venue;
  const checkIn = booking.checkIn;
  const now = Date.now();

  const day = dayLabel(localDateOf(booking.startsAt, timezone));
  const card = ((): { title: string; body: string; showCode?: boolean } | null => {
    if (booking.move && !ended)
      return {
        title: t("screens.booking.moved.title"),
        body: t("screens.booking.moved.body", {
          deadline: deadlineLabel(booking.move.respondBy, timezone),
        }),
      };
    switch (booking.status) {
      case "PENDING":
        if (ended)
          return {
            title: t("screens.booking.ended.EXPIRED"),
            body: t("screens.booking.why.unanswered"),
          };
        return {
          title: t("screens.booking.pending.title", { venue: venueName }),
          body: booking.expiresAt
            ? t("screens.booking.pending.body", {
                deadline: deadlineLabel(booking.expiresAt, timezone),
              })
            : t("screens.booking.pending.soon"),
        };
      case "HELD":
        if (ended || !booking.expiresAt)
          return {
            title: t("screens.booking.ended.EXPIRED"),
            body: t("screens.booking.why.unpaid"),
          };
        return {
          title: t("screens.booking.held.title"),
          body: t("screens.booking.held.body", {
            deadline: deadlineLabel(booking.expiresAt, timezone),
          }),
        };
      case "UNCONFIRMED":
        if (ended || !booking.expiresAt)
          return {
            title: t("screens.booking.ended.RELEASED"),
            body: t("screens.booking.why.released"),
          };
        return {
          title: t("screens.booking.weekly.title"),
          body: t("screens.booking.weekly.body", {
            deadline: deadlineLabel(booking.expiresAt, timezone),
          }),
        };
      case "CONFIRMED":
      case "COMPLETED": {
        if (checkIn?.checkedInAt)
          return {
            title: t("screens.booking.checkedIn.title"),
            body: t("screens.booking.checkedIn.body", {
              time: timeOfDay(checkIn.checkedInAt, timezone),
            }),
          };
        if (ended)
          return {
            title: t("screens.booking.ended.COMPLETED"),
            body: t("screens.booking.why.played", { day }),
          };
        if (checkIn && now < Date.parse(checkIn.closesAt))
          return {
            title: t("screens.booking.checkIn.title"),
            body: t("screens.booking.checkIn.body", {
              from: timeOfDay(checkIn.opensAt, timezone),
              until: timeOfDay(checkIn.closesAt, timezone),
            }),
            showCode: true,
          };
        return null;
      }
      case "NO_SHOW":
        return { title: t("screens.booking.ended.NO_SHOW"), body: t("screens.booking.why.noShow") };
      case "RELEASED":
        return {
          title: t("screens.booking.ended.RELEASED"),
          body: t("screens.booking.why.released"),
        };
      case "EXPIRED":
        return {
          title: t("screens.booking.ended.EXPIRED"),
          body:
            booking.expiredFrom === "PENDING"
              ? t("screens.booking.why.unanswered")
              : booking.expiredFrom === "HELD"
                ? t("screens.booking.why.unpaid")
                : t("screens.booking.why.expired"),
        };
      case "CANCELLED": {
        const cancelled = booking.cancelled;
        // The venue's or support's own words when they gave a reason.
        const reason = cancelled?.reason ? `“${cancelled.reason}”` : null;
        if (cancelled?.declined)
          return {
            title: t("screens.booking.ended.declined"),
            body: reason ?? t("screens.booking.why.declined"),
          };
        if (cancelled?.by === "CUSTOMER")
          return {
            title: t("screens.booking.ended.CANCELLED"),
            body: t("screens.booking.why.youCancelled"),
          };
        if (cancelled?.by === "ADMIN")
          return {
            title: t("screens.booking.ended.CANCELLED"),
            body: reason ?? t("screens.booking.why.supportCancelled"),
          };
        return {
          title: t("screens.booking.ended.CANCELLED"),
          body: reason ?? t("screens.booking.why.venueCancelled"),
        };
      }
      default:
        return null;
    }
  })();

  if (!card) return null;
  return (
    <View className="mt-[22px] gap-3 rounded-[20px] bg-chip p-[18px]">
      <View className="gap-0.5">
        <Text className="text-subtitle leading-[22px] font-medium">{card.title}</Text>
        <Text className="text-label leading-5 text-ink-2">{card.body}</Text>
      </View>
      {card.showCode ? (
        <Button
          label={t("screens.booking.showCode")}
          size="small"
          icon={<IconQrcode size={20} color={colors.white} strokeWidth={2} />}
          onPress={() => push({ pathname: "/bookings/[id]/check-in", params: { id: booking.id } })}
        />
      ) : null}
    </View>
  );
}
