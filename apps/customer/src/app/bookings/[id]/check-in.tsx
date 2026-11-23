import { isProblem } from "@hagz/api";
import type { components } from "@hagz/api";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Button } from "@/components/button";
import { CheckedInArt } from "@/components/checked-in-art";
import { CloseButton } from "@/components/nav";
import { FailedMessage, PageState } from "@/components/page-state";
import { QrCode } from "@/components/qr-code";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { kindOf, timeOfDay, timeRange } from "@/lib/venue";

// Check-in (Figma C8 "Check-in · My code", 257:2, and "Check-in · Done", 276:2): the booker's
// name over a QR code for the desk to scan. The code changes every 30 seconds (each works for 60),
// so a screenshot stops working; a ring counts down to the next. While it's open the booking is
// read again every few seconds, and once the desk has scanned it the screen turns into You're
// checked in, the stub torn off the ticket.

type Booking = components["schemas"]["Booking"];
type Code = components["schemas"]["CheckInCode"];

const ROW = 40;
const QR = 232;
const RING = 36;
const RING_STROKE = 3;
// How often the booking is read again, to notice the desk's scan.
const WATCH_MS = 4000;

type Loaded =
  | { state: "loading" }
  | { state: "failed"; error: unknown }
  | { state: "ready"; booking: Booking; name: string };

export default function CheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      send(api.GET("/v1/bookings/{bookingId}", { params: { path: { bookingId: id } } })),
      send(api.GET("/v1/customers/me")),
    ]).then(([booking, me]) => {
      if (!active) return;
      if (!booking.ok) setLoaded({ state: "failed", error: booking.error });
      else setLoaded({ state: "ready", booking: booking.data, name: me.ok ? me.data.name : "" });
    });
    return () => {
      active = false;
    };
  }, [id, attempt]);

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
  return <Content initial={loaded.booking} name={loaded.name} />;
}

function Content({ initial, name }: { initial: Booking; name: string }) {
  const [booking, setBooking] = useState(initial);
  const checkedInAt = booking.checkIn?.checkedInAt ?? null;

  // Watching for the desk's scan, until it comes.
  useEffect(() => {
    if (checkedInAt) return;
    const timer = setInterval(() => {
      void send(
        api.GET("/v1/bookings/{bookingId}", { params: { path: { bookingId: booking.id } } }),
      ).then((result) => {
        if (result.ok) setBooking(result.data);
      });
    }, WATCH_MS);
    return () => clearInterval(timer);
  }, [booking.id, checkedInAt]);

  return checkedInAt ? (
    <Done booking={booking} at={checkedInAt} />
  ) : (
    <MyCode booking={booking} name={name} />
  );
}

function MyCode({ booking, name }: { booking: Booking; name: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { timezone } = booking.venue;
  const [code, setCode] = useState<Code | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const now = useSecond();

  // A code, then the next one at its refreshAt, for as long as the screen is open. A failed fetch
  // keeps showing the last code while it still works, and tries again shortly.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetchCode = async () => {
      const result = await send(
        api.GET("/v1/bookings/{bookingId}/check-in-code", {
          params: { path: { bookingId: booking.id } },
        }),
      );
      if (!active) return;
      if (result.ok) {
        setCode(result.data);
        setFailure(null);
        timer = setTimeout(
          () => void fetchCode(),
          Math.max(1000, Date.parse(result.data.refreshAt) - Date.now()),
        );
      } else {
        setFailure(result.error);
        // A problem from the API (check-in closed, not checkable) won't change on its own.
        if (!isProblem(result.error)) timer = setTimeout(() => void fetchCode(), 5000);
      }
    };
    void fetchCode();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [booking.id, attempt]);

  const working = code && Date.parse(code.expiresAt) > now ? code : null;
  const secondsLeft = code ? Math.max(0, Math.ceil((Date.parse(code.refreshAt) - now) / 1000)) : 0;
  const window = booking.checkIn;
  const groundName = booking.ground.name ?? kindOf(booking.ground);
  const opened = window ? now >= Date.parse(window.opensAt) : true;

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <View className="px-5" style={{ paddingTop: insets.top + 8 }}>
        <View className="-mx-1 h-10 flex-row items-center">
          <CloseButton onPress={() => router.back()} />
        </View>
      </View>

      <View className="items-center px-6 pt-4">
        <Text
          accessibilityRole="header"
          className="text-center text-title font-semibold tracking-[-0.4px]"
          numberOfLines={1}
        >
          {name || t("screens.checkIn.you")}
        </Text>
        <Text className="pt-1 text-center text-body leading-[23px] text-ink-2">
          {[
            t("screens.checkIn.booker"),
            groundName,
            timeRange(booking.startsAt, booking.endsAt, timezone),
          ].join(" · ")}
        </Text>
      </View>

      {working || !failure ? (
        <>
          {/* The code, in a white card that gives it its quiet zone. */}
          <View className="mt-9 items-center">
            <View className="rounded-[28px] border border-border bg-white p-[22px]">
              <View style={{ width: QR, height: QR }} className="items-center justify-center">
                {working ? (
                  <Animated.View key={working.code} entering={FadeIn.duration(180)}>
                    <QrCode value={working.code} size={QR} />
                  </Animated.View>
                ) : (
                  <ActivityIndicator color={colors.ink} />
                )}
              </View>
            </View>
          </View>

          {code ? (
            <View className="mt-7 flex-row items-center justify-center gap-3">
              <Countdown refreshAt={code.refreshAt} />
              <View>
                <Text className="text-subtitle leading-[22px] font-medium">
                  {t("screens.checkIn.newCode", { count: secondsLeft })}
                </Text>
                <Text className="text-caption leading-[18px] text-unit">
                  {t("screens.checkIn.noScreenshots")}
                </Text>
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View className="flex-1 items-center justify-center px-6 pb-16">
          {isProblem(failure) ? (
            <Text className="text-center text-subtitle text-ink-2">{hudMessage(failure)}</Text>
          ) : (
            <>
              <FailedMessage error={failure} />
              <View className="mt-6 self-stretch">
                <Button
                  label={t("common.actions.tryAgain")}
                  variant="secondary"
                  onPress={() => setAttempt((n) => n + 1)}
                />
              </View>
            </>
          )}
        </View>
      )}

      {window ? (
        <Text
          className="absolute right-6 left-6 text-center text-label leading-5 text-ink-2"
          style={{ bottom: insets.bottom + 24 }}
        >
          {opened
            ? t("screens.checkIn.openUntil", { until: timeOfDay(window.closesAt, timezone) })
            : t("screens.checkIn.opensAt", {
                from: timeOfDay(window.opensAt, timezone),
                until: timeOfDay(window.closesAt, timezone),
              })}
        </Text>
      ) : null}
    </View>
  );
}

// The time now, ticking each second.
function useSecond() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A ring emptying, smoothly, until the next code: full when a code arrives, gone at its refreshAt.
function Countdown({ refreshAt }: { refreshAt: string }) {
  const radius = (RING - RING_STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const left = useSharedValue(1);

  useEffect(() => {
    const remaining = Math.max(0, Date.parse(refreshAt) - Date.now());
    left.value = 1;
    left.value = withTiming(0, { duration: remaining, easing: Easing.linear });
    return () => cancelAnimation(left);
  }, [refreshAt, left]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - left.value) }));

  return (
    <Svg width={RING} height={RING} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle
        cx={RING / 2}
        cy={RING / 2}
        r={radius}
        stroke={colors.chip}
        strokeWidth={RING_STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={RING / 2}
        cy={RING / 2}
        r={radius}
        stroke={colors.ink}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={length}
        animatedProps={props}
        fill="none"
      />
    </Svg>
  );
}

// The desk scanned it: the stub torn off, when and where, and Done back to the booking.
function Done({ booking, at }: { booking: Booking; at: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const venueName = booking.venue.name ?? t("screens.venue.fallbackName");
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      className="flex-1 bg-white"
      style={{ direction: isRTL ? "rtl" : "ltr" }}
    >
      <StatusBar style="dark" />
      <View className="items-center px-6" style={{ paddingTop: insets.top + 96 }}>
        <CheckedInArt />
        <Text
          accessibilityRole="header"
          className="pt-6 text-center text-title font-semibold tracking-[-0.4px]"
        >
          {t("screens.checkIn.doneTitle")}
        </Text>
        <Text className="pt-1.5 text-center text-body leading-[23px] text-ink-2">
          {t("screens.checkIn.doneBody", {
            time: timeOfDay(at, booking.venue.timezone),
            venue: venueName,
          })}
        </Text>
      </View>
      <View className="absolute right-6 left-6" style={{ bottom: insets.bottom + 12 }}>
        <Button label={t("screens.booked.done")} onPress={() => router.back()} />
      </View>
    </Animated.View>
  );
}
