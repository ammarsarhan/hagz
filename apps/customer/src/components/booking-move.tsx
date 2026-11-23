import type { components } from "@hagz/api";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import { dayLabel, deadlineLabel, kindOf, localDateOf, timeOfDay, timeRange } from "@/lib/venue";
import { Button } from "./button";
import { useHud } from "./hud";
import { IconClock } from "./icons";
import { BackButton } from "./nav";
import { Sheet } from "./sheet";
import { Text } from "./text";

// A booking the venue moved, while the player can still answer (Figma C8 "Booking · Moved by the
// venue", 264:2): the page is the question. What it was, struck through, over what it is now, the
// venue's reason, and what it costs; when the answer is due (silence keeps the new time); then
// Keep the new time, Move it back (while the old time is still free) and I can't make it, which asks
// first in a sheet (265:2): it counts as the venue's cancellation, so nothing is owed.

type Booking = components["schemas"]["Booking"];
type Answer = "accept" | "back" | "reject";

const ROW = 40;

export function MovedBooking({
  booking,
  onAnswered,
}: {
  booking: Booking & { move: NonNullable<Booking["move"]> };
  onAnswered: (booking: Booking) => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const { move, venue, currency } = booking;
  const { timezone } = venue;
  const [sending, setSending] = useState<Answer | null>(null);
  const [asking, setAsking] = useState(false);

  const venueName = venue.name ?? t("screens.venue.fallbackName");
  const groundName = booking.ground.name ?? kindOf(booking.ground);
  const when = (startsAt: string, endsAt: string) =>
    t("formats.moment", {
      day: dayLabel(localDateOf(startsAt, timezone)),
      time: timeRange(startsAt, endsAt, timezone),
    });
  const was = `${when(move.from.startsAt, move.from.endsAt)} · ${move.from.ground.name ?? groundName}`;
  const now = `${when(booking.startsAt, booking.endsAt)} · ${groundName}`;

  const total = formatPrice(booking.total, currency);
  const difference = formatPrice(Math.abs(move.priceDifference), currency);
  const price =
    move.priceDifference === 0
      ? t("screens.booking.move.priceSame", { total })
      : move.priceDifference > 0
        ? t("screens.booking.move.priceMore", { total, difference })
        : t("screens.booking.move.priceLess", { total, difference });

  const answer = async (kind: Answer) => {
    setSending(kind);
    const bookingId = booking.id;
    const result = await send(
      kind === "accept"
        ? api.POST("/v1/bookings/{bookingId}/move/accept", { params: { path: { bookingId } } })
        : kind === "back"
          ? api.POST("/v1/bookings/{bookingId}/move/back", { params: { path: { bookingId } } })
          : api.POST("/v1/bookings/{bookingId}/move/reject", { params: { path: { bookingId } } }),
    );
    setSending(null);
    setAsking(false);
    if (result.ok) onAnswered(result.data);
    else hud.show(hudMessage(result.error));
  };

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <View className="px-5" style={{ paddingTop: insets.top + 8 }}>
        <View className="-mx-1 flex-row items-center" style={{ height: ROW }}>
          <BackButton onPress={() => router.back()} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 240 }}
      >
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {when(booking.startsAt, booking.endsAt)}
        </Text>
        <Text className="mt-1 text-body leading-[23px] text-ink-2">
          {[groundName, kindOf(booking.ground), venueName].join(" · ")}
        </Text>

        {/* What changed: was, struck through, over now; their reason; the price. */}
        <View className="mt-6 gap-3.5 rounded-[18px] border border-border p-[18px]">
          <Text className="text-subtitle leading-[22px] font-medium">
            {t("screens.booking.move.title", { venue: venueName })}
          </Text>
          <View className="gap-0.5">
            <Text className="text-caption leading-[18px] text-unit">
              {t("screens.booking.move.was")}
            </Text>
            <Text className="text-subtitle leading-[22px] font-medium text-unit line-through">
              {was}
            </Text>
          </View>
          <View className="gap-0.5">
            <Text className="text-caption leading-[18px] text-unit">
              {t("screens.booking.move.now")}
            </Text>
            <Text className="text-subtitle leading-[22px] font-medium">{now}</Text>
          </View>
          {move.reason ? (
            <View
              className="py-0.5"
              style={
                isRTL
                  ? { borderRightWidth: 2, borderColor: colors.ink, paddingRight: 12 }
                  : { borderLeftWidth: 2, borderColor: colors.ink, paddingLeft: 12 }
              }
            >
              <Text className="text-body leading-[21px]">{`“${move.reason}”`}</Text>
            </View>
          ) : null}
          <View className="flex-row items-center justify-between">
            <Text className="text-label leading-5 text-ink-2">
              {t("screens.booking.move.price")}
            </Text>
            <Text className="text-body leading-[22px] font-medium">{price}</Text>
          </View>
        </View>

        {/* When the answer's due, and what silence means. */}
        <View className="mt-[18px] flex-row gap-2.5">
          <View className="pt-px">
            <IconClock size={18} color={colors.ink2} strokeWidth={1.75} />
          </View>
          <Text className="flex-1 text-label leading-5 text-ink-2">
            <Text className="text-label leading-5 font-medium text-ink">
              {t("screens.booking.move.answerBy", {
                deadline: deadlineLabel(move.respondBy, timezone),
              })}
            </Text>
            {` ${t("screens.booking.move.silence")}`}
          </Text>
        </View>
      </ScrollView>

      {/* The answers, pinned at the bottom. */}
      <View
        className="absolute right-6 left-6 gap-2.5 bg-white pt-3"
        style={{ bottom: insets.bottom + 12 }}
      >
        <Button
          label={t("screens.booking.move.keep")}
          loading={sending === "accept"}
          disabled={sending !== null && sending !== "accept"}
          onPress={() => void answer("accept")}
        />
        {move.canMoveBack ? (
          <Button
            label={t("screens.booking.move.back", {
              time: timeOfDay(move.from.startsAt, timezone),
            })}
            variant="secondary"
            loading={sending === "back"}
            disabled={sending !== null && sending !== "back"}
            onPress={() => void answer("back")}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={sending !== null}
          onPress={() => setAsking(true)}
          className="items-center py-1.5 active:opacity-60"
        >
          <Text className="text-body leading-[22px] font-medium underline">
            {t("screens.booking.move.cantMake")}
          </Text>
        </Pressable>
      </View>

      {/* I can't make it: asked first, since it can't be undone. */}
      <Sheet visible={asking} onClose={() => sending === null && setAsking(false)}>
        <Text className="text-heading font-semibold tracking-[-0.4px]">
          {t("screens.booking.move.cancelTitle")}
        </Text>
        <Text className="pt-2 text-body leading-[21px] text-ink-2">
          {booking.paid > 0
            ? t("screens.booking.move.cancelBodyPaid", { venue: venueName })
            : t("screens.booking.move.cancelBody", { venue: venueName })}
        </Text>
        <View className="mt-7 gap-2.5">
          <Button
            label={t("screens.booking.move.cancel")}
            loading={sending === "reject"}
            onPress={() => void answer("reject")}
          />
          <Button
            label={t("screens.booking.move.keepIt")}
            variant="secondary"
            disabled={sending !== null}
            onPress={() => setAsking(false)}
          />
        </View>
      </Sheet>
    </View>
  );
}
