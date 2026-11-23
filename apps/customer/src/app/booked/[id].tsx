import { router, Stack, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Icon } from "@tabler/icons-react-native";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconCalendarPlus, IconShare } from "@/components/icons";
import { MatchTicket } from "@/components/match-ticket";
import { CloseButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { justBooked, type Booking } from "@/lib/just-booked";
import { intlLocale, isRTL } from "@/lib/language";
import { webLinks } from "@/lib/links";
import { formatPrice } from "@/lib/money";
import {
  dayLabel,
  hourAt,
  kindOf,
  localDateOf,
  momentLabel,
  timeOfDay,
  timeRange,
  type PublicVenue,
} from "@/lib/venue";

// After Book (Figma C8 round 2): "Sent to Nile Kickoff" (260:2) while the venue approves, until the
// booking's expiresAt, or "You're booked" (261:2) once it's confirmed. Both show the match ticket.
// Booked adds Add to calendar and Share. The booking is made, so there's no way back into the
// checkout: no swipe back, and X, Done and Android's back close it to the venue page.

const ROW = 40;
const TITLE_GAP = 22;
const DAY = 86_400_000;
// From this hour on, a deadline later today reads "tonight".
const EVENING = 17;

type Loaded =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; booking: Booking; venue: PublicVenue };

export default function Booked() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>(() => {
    const handed = justBooked(id);
    return handed ? { state: "ready", ...handed } : { state: "loading" };
  });
  const [attempt, setAttempt] = useState(0);

  // Opened any other way than from Review: the booking, then its venue (the timezone and area).
  useEffect(() => {
    if (justBooked(id) && attempt === 0) return;
    let active = true;
    setLoaded({ state: "loading" });
    void (async () => {
      const booking = await send(
        api.GET("/v1/bookings/{bookingId}", { params: { path: { bookingId: id } } }),
      );
      if (!active) return;
      if (!booking.ok) {
        setLoaded({ state: "failed", message: hudMessage(booking.error) });
        return;
      }
      const venue = await send(
        api.GET("/v1/venues/{slug}", { params: { path: { slug: booking.data.venue.slug } } }),
      );
      if (!active) return;
      setLoaded(
        venue.ok
          ? { state: "ready", booking: booking.data, venue: venue.data }
          : { state: "failed", message: hudMessage(venue.error) },
      );
    })();
    return () => {
      active = false;
    };
  }, [id, attempt]);

  if (loaded.state === "loading") return <PageState loading />;
  if (loaded.state === "failed") {
    return <PageState message={loaded.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  return <Content booking={loaded.booking} venue={loaded.venue} />;
}

// Whole days from today to a date, both at the venue's clock.
const daysUntil = (iso: string, timezone: string) =>
  Math.round(
    (Date.parse(localDateOf(iso, timezone)) -
      Date.parse(localDateOf(new Date().toISOString(), timezone))) /
      DAY,
  );

function Content({ booking, venue }: { booking: Booking; venue: PublicVenue }) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer);

  const { timezone } = venue.marketplace;
  const sent = booking.status === "PENDING";
  const venueName = booking.venue.name ?? venue.name ?? "";
  const groundName = booking.ground.name ?? kindOf(booking.ground);

  // Back to the venue page, closing the checkout under this screen.
  const close = () =>
    router.dismissTo({ pathname: "/venue/[slug]", params: { slug: booking.venue.slug } });
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => listener.remove();
  });

  // "10:40 pm tonight", "9 am tomorrow", or "Wed 25 Nov, 9 pm".
  const deadline = (iso: string) => {
    const days = daysUntil(iso, timezone);
    const time = timeOfDay(iso, timezone);
    if (days === 0)
      return t(
        hourAt(iso, timezone) >= EVENING ? "screens.booked.tonight" : "screens.booked.today",
        { time },
      );
    if (days === 1) return t("screens.booked.tomorrow", { time });
    return momentLabel(iso, timezone);
  };

  // "See you today / tomorrow / Thursday / on Thu 3 Dec."
  const seeYou = () => {
    const days = daysUntil(booking.startsAt, timezone);
    if (days <= 0) return t("screens.booked.seeYouToday");
    if (days === 1) return t("screens.booked.seeYouTomorrow");
    if (days < 7) {
      const weekday = new Intl.DateTimeFormat(intlLocale, {
        timeZone: timezone,
        weekday: "long",
      }).format(new Date(booking.startsAt));
      return t("screens.booked.seeYouOn", { day: weekday });
    }
    return t("screens.booked.seeYouDate", {
      date: dayLabel(localDateOf(booking.startsAt, timezone)),
    });
  };

  const area = venue.location.area?.split(",")[0]?.trim();
  const range = timeRange(booking.startsAt, booking.endsAt, timezone);
  const day = dayLabel(localDateOf(booking.startsAt, timezone));
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

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + ROW + TITLE_GAP,
          paddingHorizontal: 24,
          paddingBottom: footer + 32,
        }}
      >
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {sent
            ? venueName
              ? t("screens.booked.sentTitle", { venue: venueName })
              : t("screens.booked.sentTitleNoName")
            : t("screens.booked.bookedTitle")}
        </Text>
        <Text className="mt-1.5 text-body text-ink-2">
          {sent
            ? t("screens.booked.sentBody", {
                deadline: booking.expiresAt ? deadline(booking.expiresAt) : "",
              })
            : seeYou()}
        </Text>

        <View className="mt-7">
          <MatchTicket
            status={
              sent
                ? { label: t("screens.booked.waiting"), dot: "grey" }
                : { label: t("screens.booked.confirmed"), dot: "black" }
            }
            day={day}
            range={range}
            ground={`${groundName} · ${kindOf(booking.ground)}`}
            venue={area ? `${venueName}, ${area}` : venueName}
            code={booking.code}
            codeLabel={t("screens.booked.code")}
            priceLabel={t(`screens.booked.paid.${booking.paymentMode}`)}
            price={formatPrice(booking.total, booking.currency)}
          />
        </View>

        {sent ? (
          <Text className="mt-[18px] text-label leading-5 text-ink-2">
            {t("screens.booked.held")}
          </Text>
        ) : (
          <View className="mt-4 flex-row gap-2.5">
            <Pill
              icon={IconCalendarPlus}
              label={t("screens.booked.calendar")}
              // Adding to the phone's calendar needs a native module, so it waits for the next
              // scheduled build (docs/plan.md, "Native builds").
              onPress={() => hud.show(t("screens.booked.calendarSoon"))}
            />
            {link ? (
              <Pill icon={IconShare} label={t("screens.booked.share")} onPress={share} />
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* The close button, alone in the bar. */}
      <View
        className="absolute top-0 right-0 left-0 bg-white px-5"
        style={{ height: insets.top + ROW + 8, paddingTop: insets.top }}
      >
        <View className="-mx-1 h-10 flex-row items-center">
          <CloseButton onPress={close} />
        </View>
      </View>

      <View
        className="absolute right-0 bottom-0 left-0 gap-2.5 bg-white px-6 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
      >
        <Button
          label={t("screens.booked.view")}
          // The booking page is the next screen to build; until then, it says so.
          onPress={() => hud.show(t("screens.booked.bookingPageSoon"))}
        />
        {sent ? (
          <Button label={t("screens.booked.done")} variant="secondary" onPress={close} />
        ) : null}
      </View>
    </View>
  );
}

// A grey pill under the ticket: an 18 icon and a 15 label, sharing the row with its neighbour.
function Pill({ icon: Glyph, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-chip px-3.5 active:opacity-70"
    >
      <Glyph size={18} color={colors.ink} strokeWidth={1.75} />
      <Text className="text-body">{label}</Text>
    </Pressable>
  );
}
