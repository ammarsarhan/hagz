import { isProblem } from "@hagz/api";
import type { components } from "@hagz/api";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { api } from "@/lib/api";
import { hudMessage, type Result, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { timeOfDay, timeRange } from "@/lib/venue";
import { Button } from "./button";
import { CheckedInArt, TORN_AT } from "./checked-in-art";
import { CloseButton } from "./nav";
import { FailedMessage, PageState } from "./page-state";
import { QrCode } from "./qr-code";
import { Text } from "./text";

// Check-in (Figma C8 "Check-in · My code", 257:2, and "Check-in · Done", 276:2): the player's
// name over a QR code for the desk to scan, for a booking (the booker) or a game joined (a player).
// The code changes every 30 seconds (each works for 60), so a screenshot stops working; a ring
// counts down to the next. While it's open the pass is read again every few seconds, and once the
// desk has scanned it the screen turns into You're checked in, the stub torn off the ticket.

type Code = components["schemas"]["CheckInCode"];
type Window = NonNullable<components["schemas"]["Booking"]["checkIn"]>;

// What the screen shows, from a booking or a game.
export interface Pass {
  // "Booker", or "Player" in someone's game.
  role: string;
  groundName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string;
  checkIn: Window | null;
}

interface Source {
  // The pass, read again while the screen is open.
  read: () => Promise<Result<Pass>>;
  code: () => Promise<Result<Code>>;
}

const ROW = 40;
const QR = 232;
// How long a new code takes to fade in over the old one.
const QR_FADE = 450;
const RING = 36;
const RING_STROKE = 3;
// How often the pass is read again, to notice the desk's scan.
const WATCH_MS = 4000;

type Loaded =
  | { state: "loading" }
  | { state: "failed"; error: unknown }
  | { state: "ready"; pass: Pass; name: string };

export function CheckInScreen({ id, source }: { id: string; source: Source }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([source.read(), send(api.GET("/v1/customers/me"))]).then(([pass, me]) => {
      if (!active) return;
      if (!pass.ok) setLoaded({ state: "failed", error: pass.error });
      else setLoaded({ state: "ready", pass: pass.data, name: me.ok ? me.data.name : "" });
    });
    return () => {
      active = false;
    };
    // The source is made anew each render; the id says when it's another one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  return <Content id={id} source={source} initial={loaded.pass} name={loaded.name} />;
}

function Content({
  id,
  source,
  initial,
  name,
}: {
  id: string;
  source: Source;
  initial: Pass;
  name: string;
}) {
  const [pass, setPass] = useState(initial);
  const checkedInAt = pass.checkIn?.checkedInAt ?? null;

  // Watching for the desk's scan, until it comes.
  useEffect(() => {
    if (checkedInAt) return;
    const timer = setInterval(() => {
      void source.read().then((result) => {
        if (result.ok) setPass(result.data);
      });
    }, WATCH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, checkedInAt]);

  return checkedInAt ? (
    // The tear plays when the scan comes in while it's open, not on opening it again later.
    <Done pass={pass} at={checkedInAt} intro={!initial.checkIn?.checkedInAt} />
  ) : (
    <MyCode id={id} source={source} pass={pass} name={name} />
  );
}

function MyCode({
  id,
  source,
  pass,
  name,
}: {
  id: string;
  source: Source;
  pass: Pass;
  name: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { timezone } = pass;
  const [code, setCode] = useState<Held | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const now = useSecond();

  // A code, then the next one at its refreshAt, for as long as the screen is open. A failed fetch
  // keeps showing the last code while it still works, and tries again shortly.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetchCode = async () => {
      const result = await source.code();
      if (!active) return;
      if (result.ok) {
        const held = heldFrom(result.data);
        setCode(held);
        setFailure(null);
        timer = setTimeout(() => void fetchCode(), Math.max(1000, held.refreshAt - Date.now()));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const working = code && code.expiresAt > now ? code.code : null;
  const secondsLeft = useCountdown(code?.refreshAt ?? null);
  const window = pass.checkIn;
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
        {/* Who, which ground, when: spaced apart, a dot between each. */}
        <View className="flex-row flex-wrap items-center justify-center gap-x-1.5 pt-1">
          {[pass.role, pass.groundName, timeRange(pass.startsAt, pass.endsAt, timezone)].map(
            (part, index) => (
              <View key={index} className="flex-row items-center gap-x-1.5">
                {index > 0 ? <Text className="text-body leading-[23px] text-ink-3">·</Text> : null}
                <Text className="text-body leading-[23px] text-ink-2">{part}</Text>
              </View>
            ),
          )}
        </View>
      </View>

      {working || !failure ? (
        <>
          {/* The code, in a white card that gives it its quiet zone. */}
          <View className="mt-9 items-center">
            <View className="rounded-[28px] border border-border bg-white p-[22px]">
              <View style={{ width: QR, height: QR }} className="items-center justify-center">
                {working ? (
                  // Each new code fades in over the last as it fades out: both stacked in place.
                  <Animated.View
                    key={working.code}
                    entering={FadeIn.duration(QR_FADE)}
                    exiting={FadeOut.duration(QR_FADE)}
                    style={{ position: "absolute", top: 0, left: 0 }}
                  >
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
              <View className="mt-6">
                <Button
                  label={t("common.actions.tryAgain")}
                  variant="secondary"
                  size="small"
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
// A code as held on the phone: when it's due to change and when it stops working, on the phone's
// clock. The server's times are on its clock, which can be a second or more off the phone's (it
// started at 31 s), so only their spans are used: the server issued it CODE_LIFETIME before it
// expires, so it changes (refreshAt - issued) after it arrived here.
interface Held {
  code: Code;
  refreshAt: number;
  expiresAt: number;
}
// Each code works for 60 seconds (the check-in-code endpoints).
const CODE_LIFETIME = 60_000;
const heldFrom = (code: Code): Held => {
  const arrived = Date.now();
  const issued = Date.parse(code.expiresAt) - CODE_LIFETIME;
  return {
    code,
    refreshAt: arrived + (Date.parse(code.refreshAt) - issued),
    expiresAt: arrived + CODE_LIFETIME,
  };
};

// Whole seconds until a moment, ticking on that moment's own second marks (not every second from
// whenever the screen opened), so no number is skipped or shown twice.
function useCountdown(deadline: number | null) {
  const left = () =>
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    if (deadline === null) return setSeconds(0);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const remaining = deadline - Date.now();
      setSeconds(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) return;
      // Just past the next whole second before the deadline.
      timer = setTimeout(tick, (remaining % 1000 || 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [deadline]);
  return seconds;
}

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
function Countdown({ refreshAt }: { refreshAt: number }) {
  const radius = (RING - RING_STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const left = useSharedValue(1);

  useEffect(() => {
    const remaining = Math.max(0, refreshAt - Date.now());
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

// The desk scanned it: the stub torn off, when and where, and Done back to where it came from.
function Done({ pass, at, intro }: { pass: Pass; at: string; intro: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { venueName } = pass;
  // A success tap in the hand as the stub tears off.
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(
      () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      TORN_AT,
    );
    return () => clearTimeout(timer);
  }, [intro]);
  // The words, then Done, come in once it's torn.
  const after = intro ? TORN_AT : 0;
  const words = FadeIn.delay(after + 150).duration(320);
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      className="flex-1 bg-white"
      style={{ direction: isRTL ? "rtl" : "ltr" }}
    >
      <StatusBar style="dark" />
      <View className="items-center px-6" style={{ paddingTop: insets.top + 96 }}>
        <CheckedInArt intro={intro} />
        <Animated.View entering={words} className="items-center">
          <Text
            accessibilityRole="header"
            className="pt-6 text-center text-title font-semibold tracking-[-0.4px]"
          >
            {t("screens.checkIn.doneTitle")}
          </Text>
          <Text className="pt-1.5 text-center text-body leading-[23px] text-ink-2">
            {t("screens.checkIn.doneBody", {
              time: timeOfDay(at, pass.timezone),
              venue: venueName,
            })}
          </Text>
        </Animated.View>
      </View>
      <Animated.View
        entering={FadeIn.delay(after + 350).duration(320)}
        className="absolute right-6 left-6"
        style={{ bottom: insets.bottom + 12 }}
      >
        <Button label={t("screens.booked.done")} onPress={() => router.back()} />
      </Animated.View>
    </Animated.View>
  );
}
