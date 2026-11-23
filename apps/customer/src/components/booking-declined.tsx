import type { components } from "@hagz/api";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { push } from "@/lib/navigation";
import { dayLabel, hourAt, kindOf, localDateOf, timeRange } from "@/lib/venue";
import { Button } from "./button";
import { IconSearch } from "./icons";
import { BackButton } from "./nav";
import { Text } from "./text";

// A booking the venue said no to (Figma C10 "Booking · Declined", 278:2): no card, just who
// couldn't take it, their reason in their words, and that nothing was charged (or that it comes
// back). While the game is still ahead, the way on: Similar venues opens Search around this venue
// for the same kind of ground at the same time; Another time at the venue opens its page.

type Booking = components["schemas"]["Booking"];

const ROW = 40;
const HOUR = 3_600_000;

export function DeclinedBooking({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { venue, ground } = booking;
  const { timezone } = venue;
  const venueName = venue.name ?? t("screens.venue.fallbackName");
  const groundName = ground.name ?? kindOf(ground);
  const reason = booking.cancelled?.reason;
  const ahead = Date.parse(booking.startsAt) > Date.now();

  // Search, set to this booking: around the venue, the same sport and size, the same day, hour and
  // length. `at` makes each tap a new preset, so Search applies it even when it was already open.
  // Search is a tab: the stack is unwound to the tabs, so there's nothing to swipe back to.
  const similar = () =>
    router.dismissTo({
      pathname: "/search",
      params: {
        at: String(Date.now()),
        near: venueName,
        ...(venue.coordinates
          ? {
              latitude: String(venue.coordinates.latitude),
              longitude: String(venue.coordinates.longitude),
            }
          : {}),
        sport: ground.sport,
        ...(ground.sport === "FOOTBALL" && ground.size ? { size: ground.size } : {}),
        date: localDateOf(booking.startsAt, timezone),
        start: `${String(hourAt(booking.startsAt, timezone)).padStart(2, "0")}:00`,
        hours: String(
          Math.max(
            1,
            Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / HOUR),
          ),
        ),
      },
    });

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
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 200 }}
      >
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {t("formats.moment", {
            day: dayLabel(localDateOf(booking.startsAt, timezone)),
            time: timeRange(booking.startsAt, booking.endsAt, timezone),
          })}
        </Text>
        <Text className="mt-1 text-body leading-[23px] text-ink-2">
          {[groundName, kindOf(ground), venueName].join(" · ")}
        </Text>

        {/* Who said no, in their words, and what that cost. */}
        <Text className="mt-6 text-subtitle leading-[22px] font-medium">
          {t("screens.booking.declined.title", { venue: venueName })}
        </Text>
        {reason ? (
          <Text className="pt-3.5 text-subtitle leading-[22px]">{`“${reason}”`}</Text>
        ) : null}
        <Text className="pt-3 text-label leading-5 text-ink-2">
          {booking.paid > 0
            ? t("screens.booking.declined.paidBack")
            : t("screens.booking.declined.nothingCharged")}
        </Text>

        {ahead ? (
          <View className="mt-[18px] flex-row gap-2.5">
            <View className="pt-px">
              <IconSearch size={18} color={colors.ink2} strokeWidth={1.75} />
            </View>
            <Text className="flex-1 text-label leading-5 text-ink-2">
              <Text className="text-label leading-5 font-medium text-ink">
                {t("screens.booking.declined.stillPlay")}
              </Text>
              {` ${t("screens.booking.declined.stillPlayBody")}`}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* The way on, pinned at the bottom. */}
      <View
        className="absolute right-6 left-6 gap-2.5 bg-white pt-3"
        style={{ bottom: insets.bottom + 12 }}
      >
        {ahead ? (
          <Button
            label={t("screens.booking.declined.similar")}
            icon={<IconSearch size={18} color={colors.white} strokeWidth={2.25} />}
            onPress={similar}
          />
        ) : null}
        <Button
          label={t("screens.booking.declined.anotherTime", { venue: venueName })}
          variant={ahead ? "secondary" : "ink"}
          onPress={() => push({ pathname: "/venue/[slug]", params: { slug: venue.slug } })}
        />
      </View>
    </View>
  );
}
