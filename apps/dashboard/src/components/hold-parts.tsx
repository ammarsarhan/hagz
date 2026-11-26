import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useNow } from "@/lib/use-now";
import { sentenceTime } from "@/lib/when";
import { BarButton, BottomBar } from "./bottom-bar";
import { Button } from "./button";
import { useHud } from "./hud";
import { Sheet } from "./sheet";
import { Text } from "./text";

// A held booking's parts (Figma D9 606:76): a ring running down beside when it goes back on sale,
// with one more stretch of the venue's hold length to give once; Confirm in the bar; and, in ⋯,
// letting it go at once.

type Booking = components["schemas"]["StaffBookingDetail"];

const SIZE = 112;
const STROKE = 9;
const TRACK = "#e6ebff";

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const useAfterHold = (booking: Booking, venueId: string) => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] }),
      queryClient.invalidateQueries({
        queryKey: ["staff", "venues", venueId, "bookings", "detail", booking.id],
      }),
    ]);
};

export function HoldRing({
  booking,
  venueId,
  extended,
  holdMinutes,
  canManage,
  onEnded,
}: {
  booking: Booking & { expiresAt: string };
  venueId: string;
  // It has had its one extension.
  extended: boolean;
  holdMinutes: number | null;
  canManage: boolean;
  // The time ran out: read the booking again (it's let go).
  onEnded: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const after = useAfterHold(booking, venueId);
  const now = useNow((at) => Math.floor(at / 1000) * 1000 + 1000);
  const [extending, setExtending] = useState(false);

  const deadline = Date.parse(booking.expiresAt);
  const left = deadline - now;
  // The whole hold, from when it was made (an extension makes it longer).
  const whole = Math.max(deadline - Date.parse(booking.createdAt), 1);
  const share = Math.min(Math.max(left / whole, 0), 1);
  const radius = (SIZE - STROKE) / 2;
  const around = 2 * Math.PI * radius;

  const ended = useRef(false);
  useEffect(() => {
    if (left <= 0 && !ended.current) {
      ended.current = true;
      onEnded();
    }
  }, [left, onEnded]);

  const extend = async () => {
    setExtending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/holds/{bookingId}/extend", {
        params: { path: { venueId, bookingId: booking.id } },
      }),
    );
    await after();
    setExtending(false);
    if (!result.ok) hud.show(hudMessage(result.error));
  };

  return (
    <View className="flex-row items-center">
      <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={TRACK}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* What's left, from the top, running down anticlockwise. */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${around * share} ${around}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            opacity={share > 0 ? 1 : 0}
          />
        </Svg>
        <Text
          className="text-[22px] font-semibold"
          style={{ fontVariant: ["tabular-nums"] }}
          accessibilityLabel={t("screens.booking.hold.leftLabel", { time: clock(left) })}
        >
          {clock(left)}
        </Text>
        <Text className="text-caption text-ink-2">{t("screens.booking.hold.left")}</Text>
      </View>
      <View className="ms-5 flex-1">
        <Text className="text-subtitle font-semibold">
          {t("screens.booking.hold.offSale", {
            time: sentenceTime(booking.expiresAt, booking.timezone, t),
          })}
        </Text>
        <Text className="mt-1 text-label text-ink-2">{t("screens.booking.hold.body")}</Text>
        {canManage && !extended ? (
          <Pressable
            accessibilityRole="button"
            disabled={extending}
            onPress={() => void extend()}
            hitSlop={8}
            className={`mt-2.5 self-start active:opacity-70 ${extending ? "opacity-50" : ""}`}
          >
            <Text className="text-body font-medium underline">
              {holdMinutes === null
                ? t("screens.booking.hold.morePlain")
                : t("screens.booking.hold.more", { count: holdMinutes })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// The bar: what it costs, paid at the venue, and Confirm.
export function HoldBar({
  booking,
  venueId,
  price,
  onChanged,
}: {
  booking: Booking;
  venueId: string;
  price: string;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const after = useAfterHold(booking, venueId);
  const [sending, setSending] = useState(false);
  const confirm = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/holds/{bookingId}/confirm", {
        params: { path: { venueId, bookingId: booking.id } },
      }),
    );
    await Promise.all([after(), onChanged()]);
    setSending(false);
    if (!result.ok) hud.show(hudMessage(result.error));
  };
  return (
    <BottomBar title={price} detail={t("screens.booking.hold.paidHere")}>
      <BarButton
        label={t("screens.booking.hold.confirm")}
        primary
        busy={sending}
        onPress={() => void confirm()}
      />
    </BottomBar>
  );
}

// ⋯ on a hold: let it go now, asked first. Gone, the page closes.
export function ReleaseSheet({
  booking,
  venueId,
  name,
  when,
  visible,
  onClose,
}: {
  booking: Booking;
  venueId: string;
  name: string;
  when: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const after = useAfterHold(booking, venueId);
  const [sending, setSending] = useState(false);
  const released = useRef(false);
  const release = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/holds/{bookingId}/release", {
        params: { path: { venueId, bookingId: booking.id } },
      }),
    );
    setSending(false);
    void after();
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    released.current = true;
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => {
        if (released.current) router.back();
      }}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.booking.hold.releaseTitle", { name })}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">
        {t("screens.booking.hold.releaseBody", { when })}
      </Text>
      <Button
        label={t("screens.booking.hold.release")}
        variant="ink"
        loading={sending}
        onPress={() => void release()}
      />
    </Sheet>
  );
}
