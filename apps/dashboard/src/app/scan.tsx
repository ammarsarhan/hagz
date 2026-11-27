import type { components } from "@hagz/api";
import { useQueryClient } from "@tanstack/react-query";
import type { Icon } from "@tabler/icons-react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { guarded } from "@/components/guarded";
import { useHud, useHudAnchor } from "@/components/hud";
import {
  IconCamera,
  IconCheck,
  IconCircleMinus,
  IconHistory,
  IconLock,
  IconMapPin,
  IconQrcodeOff,
  IconUserX,
  IconWifiOff,
  IconX,
} from "@/components/icons";
import { Text } from "@/components/text";
import { RULES } from "@/lib/access";
import { api } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { useNow } from "@/lib/use-now";
import { hoursSpan, sentenceTime } from "@/lib/when";

// Scanning players' check-in codes (Figma D13 554:5, and its errors 658:2): a dark camera with the
// frame to hold the code in, and after each scan a white card at the bottom saying what happened:
// who's in (or was already), or why not, naming the game when the API says which. Scanning pauses
// while a card shows; its button goes back to the camera. No red: an icon in a grey disc says it.
// Opened from Home's scan button and a booking's Scan a code bar.

type Result = components["schemas"]["CheckInResult"];
type Game = components["schemas"]["CheckInBooking"];

// The design's camera dark, and the frame's size.
const DARK = "#1b1c1f";
const FRAME = 244;
const CORNER = 36;
const LINE = 4;

type Card =
  | { kind: "in" | "already"; result: Result }
  | { kind: "early"; opensAt: string; game: Game | undefined }
  | { kind: "closed"; closesAt: string; game: Game | undefined }
  | { kind: "notIn"; name: string; game: Game | undefined }
  | { kind: "expired" | "invalid" | "otherVenue" | "noCheckIn" | "offline" };

// What a refused scan carries besides its code (problem members, apps/server check-in.ts).
type Extras = { opensAt?: string; closesAt?: string; booking?: Game; firstName?: string };

const cardFor = (error: unknown): Card | undefined => {
  const found = problem(error);
  if (!found) return { kind: "offline" };
  const extras = found as unknown as Extras;
  switch (found.code) {
    case "CHECK_IN_CODE_EXPIRED":
      return { kind: "expired" };
    case "CHECK_IN_CODE_INVALID":
      return { kind: "invalid" };
    case "CHECK_IN_OTHER_VENUE":
      return { kind: "otherVenue" };
    case "NO_CHECK_IN":
      return { kind: "noCheckIn" };
    case "NOT_IN_BOOKING":
      return { kind: "notIn", name: extras.firstName ?? "", game: extras.booking };
    case "CHECK_IN_CLOSED":
      return extras.opensAt && Date.now() < Date.parse(extras.opensAt)
        ? { kind: "early", opensAt: extras.opensAt, game: extras.booking }
        : { kind: "closed", closesAt: extras.closesAt ?? "", game: extras.booking };
    default:
      // Not about the code (no access any more, too many tries): the HUD says it.
      return undefined;
  }
};

function Scanner() {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const [permission, requestPermission] = useCameraPermissions();
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  // The last code read, for Try again after no connection, and so a code still in front of the
  // camera isn't sent twice.
  const code = useRef<string | null>(null);
  const reading = useRef(false);
  useHudAnchor(insets.bottom);

  // Asked once, the first time: the system's own prompt.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const check = async (scanned: string) => {
    reading.current = true;
    code.current = scanned;
    setBusy(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/check-ins", {
        params: { path: { venueId } },
        body: { code: scanned },
      }),
    );
    setBusy(false);
    if (result.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCard({ kind: result.data.already ? "already" : "in", result: result.data });
      // The booking's page, the Calendar and Home count who's here.
      void Promise.all(
        ["bookings", "home"].map((part) =>
          queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, part] }),
        ),
      );
      return;
    }
    const next = cardFor(result.error);
    if (next) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setCard(next);
    } else {
      hud.show(hudMessage(result.error));
      reading.current = false;
    }
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (reading.current || card || venueId === "") return;
    void check(data);
  };

  // Back to the camera; after no connection, the same code again.
  const again = () => {
    const retry = card?.kind === "offline" ? code.current : null;
    setCard(null);
    if (retry) {
      void check(retry);
      return;
    }
    code.current = null;
    reading.current = false;
  };

  const allowed = permission?.granted === true;
  const refused = permission !== null && !permission.granted;
  const shade = { backgroundColor: DARK };

  return (
    <View className="flex-1" style={shade}>
      <StatusBar style="light" />
      {allowed ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={card || busy ? undefined : onScanned}
        />
      ) : null}

      {/* The dark all round, with the frame cut out of it so the camera shows only there. */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[shade, { paddingTop: insets.top + 12 }]} className="px-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("screens.scan.close")}
            onPress={() => router.back()}
            hitSlop={8}
            className="size-10 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <IconX size={20} color={colors.white} strokeWidth={2} />
          </Pressable>
          <Text
            accessibilityRole="header"
            className="mt-5 text-title font-semibold tracking-[-0.4px] text-white"
          >
            {t("screens.scan.title")}
          </Text>
          <Text className="mt-1.5 text-subtitle text-white/70">{t("screens.scan.body")}</Text>
          <View className="h-[50px]" />
        </View>

        {refused ? (
          <View style={shade} className="flex-1 items-center px-8 pt-12">
            <Refused
              canAsk={permission.canAskAgain}
              onAllow={() => void requestPermission()}
              onClose={() => router.back()}
            />
          </View>
        ) : (
          <>
            <View className="flex-row" style={{ height: FRAME }}>
              <View className="flex-1" style={shade} />
              <View style={{ width: FRAME, height: FRAME }}>
                <Corners />
              </View>
              <View className="flex-1" style={shade} />
            </View>
            <View className="flex-1 items-center pt-6" style={shade}>
              <Text className="text-label text-white/70">{t("screens.scan.hint")}</Text>
              {busy ? <ActivityIndicator className="mt-6" color={colors.white} /> : null}
            </View>
          </>
        )}
      </View>

      {card ? (
        <Animated.View
          key={card.kind}
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(160)}
          className="absolute inset-x-4 rounded-3xl bg-white px-4 pb-[18px] pt-5"
          style={{ bottom: insets.bottom + 16 }}
        >
          <CardBody card={card} venueName={venue?.name ?? ""} />
          <Pressable
            accessibilityRole="button"
            onPress={again}
            className="mt-5 h-11 items-center justify-center rounded-full bg-chip active:opacity-70"
          >
            <Text className="text-body font-semibold">
              {t(
                card.kind === "in" || card.kind === "already"
                  ? "screens.scan.next"
                  : card.kind === "offline"
                    ? "screens.scan.retry"
                    : "screens.scan.again",
              )}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

// The frame's four white corners.
function Corners() {
  const bar = "absolute rounded-sm bg-white";
  return (
    <>
      {(["top", "bottom"] as const).map((y) =>
        (["left", "right"] as const).map((x) => (
          <View key={`${y}${x}`}>
            <View className={bar} style={{ [y]: 0, [x]: 2, width: CORNER, height: LINE }} />
            <View className={bar} style={{ [y]: 2, [x]: 0, width: LINE, height: CORNER }} />
          </View>
        )),
      )}
    </>
  );
}

// No camera: why, and the way to it (the system prompt again, or Settings once it won't ask), and
// that check-in by name on the booking still works.
function Refused({
  canAsk,
  onAllow,
  onClose,
}: {
  canAsk: boolean;
  onAllow: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View className="size-11 items-center justify-center rounded-full bg-white/15">
        <IconCamera size={22} color={colors.white} strokeWidth={1.75} />
      </View>
      <Text className="mt-5 text-center text-subtitle font-semibold text-white">
        {t("screens.scan.camera")}
      </Text>
      <Text className="mt-1 text-center text-label text-white/70">
        {t("screens.scan.cameraBody")}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={canAsk ? onAllow : () => void Linking.openSettings()}
        className="mt-5 h-11 items-center justify-center rounded-full bg-white px-6 active:opacity-70"
      >
        <Text className="text-body font-semibold">
          {t(canAsk ? "screens.scan.allowCamera" : "screens.scan.openSettings")}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={onClose} className="mt-4">
        <Text className="text-center text-caption text-white underline">
          {t("screens.scan.byName")}
        </Text>
      </Pressable>
    </>
  );
}

const ICONS: Record<Exclude<Card["kind"], "in" | "already" | "early">, Icon> = {
  closed: IconLock,
  notIn: IconUserX,
  expired: IconHistory,
  invalid: IconQrcodeOff,
  otherVenue: IconMapPin,
  noCheckIn: IconCircleMinus,
  offline: IconWifiOff,
};

function CardBody({ card, venueName }: { card: Card; venueName: string }) {
  const { t } = useTranslation();
  const game = (of: Game) => t("screens.scan.game", { name: of.bookerFirstName });
  const ground = (of: Game) => of.ground ?? "";

  let title: string;
  let line: string;
  let mark: React.ReactNode;
  switch (card.kind) {
    case "in":
    case "already": {
      const { person, booking } = card.result;
      const ink = card.kind === "in";
      mark = (
        <View
          className={`size-11 items-center justify-center rounded-full ${ink ? "bg-ink" : "bg-chip"}`}
        >
          <IconCheck size={22} color={ink ? colors.white : colors.ink} strokeWidth={2.25} />
        </View>
      );
      title = t(ink ? "screens.scan.in" : "screens.scan.already", { name: person.firstName });
      line = ink
        ? t("screens.scan.inLine", {
            game: game(booking),
            hours: hoursSpan(booking.startsAt, booking.endsAt, booking.timezone, t),
            ground: ground(booking),
          })
        : t("screens.scan.alreadyLine", {
            time: sentenceTime(person.checkedInAt ?? Date.now(), booking.timezone, t),
            game: game(booking),
            ground: ground(booking),
          });
      break;
    }
    case "early":
      return <Early opensAt={card.opensAt} game={card.game} />;
    case "closed":
      title = t("screens.scan.closed", {
        time: card.game ? sentenceTime(card.closesAt, card.game.timezone, t) : "",
      });
      line = card.game
        ? t("screens.scan.closedBody", { game: game(card.game), ground: ground(card.game) })
        : "";
      break;
    case "notIn":
      title = t("screens.scan.notIn", { name: card.name });
      line = card.game
        ? t("screens.scan.notInBody", {
            name: card.name,
            game: game(card.game),
            ground: ground(card.game),
          })
        : "";
      break;
    case "otherVenue":
      title = t("screens.scan.otherVenue");
      line = t("screens.scan.otherVenueBody", { venue: venueName });
      break;
    default:
      title = t(`screens.scan.${card.kind}`);
      line = t(`screens.scan.${card.kind}Body`);
  }
  if (card.kind !== "in" && card.kind !== "already") {
    const Glyph = ICONS[card.kind];
    mark = (
      <View className="size-11 items-center justify-center rounded-full bg-chip">
        <Glyph size={22} color={colors.ink} strokeWidth={1.75} />
      </View>
    );
  }
  return <Row mark={mark} title={title} line={line} />;
}

function Row({ mark, title, line }: { mark: React.ReactNode; title: string; line: string }) {
  return (
    <View className="flex-row items-start">
      {mark}
      <View className="ms-3.5 flex-1">
        <Text className="text-[20px] font-semibold leading-[26px]">{title}</Text>
        {line ? <Text className="text-label text-ink-2">{line}</Text> : null}
      </View>
    </View>
  );
}

// Too early: when it opens, and a ring with the minutes still to go running down to it.
const RING = 44;
const STROKE = 3;

function Early({ opensAt, game }: { opensAt: string; game: Game | undefined }) {
  const { t } = useTranslation();
  const opens = Date.parse(opensAt);
  const [from] = useState(Date.now);
  const now = useNow((at) => (at < opens ? Math.floor(at / 1000) * 1000 + 1000 : undefined));
  const left = Math.max(opens - now, 0);
  const minutes = Math.ceil(left / 60_000);
  const share = Math.min(left / Math.max(opens - from, 1), 1);
  const radius = (RING - STROKE) / 2;
  const around = 2 * Math.PI * radius;
  const timezone = game?.timezone;

  const mark = (
    <View className="size-11 items-center justify-center">
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={colors.field}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={colors.ink}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={around}
          strokeDashoffset={around * (1 - share)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text className="text-caption font-semibold">{minutes}</Text>
    </View>
  );
  return (
    <Row
      mark={mark}
      title={t("screens.scan.early", {
        time: timezone ? sentenceTime(opensAt, timezone, t) : "",
      })}
      line={
        game
          ? t("screens.scan.earlyBody", {
              count: minutes,
              game: t("screens.scan.game", { name: game.bookerFirstName }),
              hours: hoursSpan(game.startsAt, game.endsAt, game.timezone, t),
              ground: game.ground ?? "",
            })
          : ""
      }
    />
  );
}

export default guarded(RULES.book, Scanner);
