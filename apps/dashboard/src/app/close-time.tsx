import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { Field } from "@/components/field";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { moneyOf } from "@/components/time-sheets";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { localDateOf } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { useNow } from "@/lib/use-now";
import { hoursSpan, relativeDay } from "@/lib/when";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// Closing free times (Figma D16 635:2, "Close a time"; user 2026-11-27): the time picked as a dashed
// card with Change (back to the calendar), an optional note for the team, and a bar to Close. Nobody
// can book them until they're reopened.

type Params = {
  slotIds: string;
  startsAt: string;
  endsAt: string;
  ground: string;
  price: string;
  currency: string;
  timezone: string;
};

function CloseTime() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const hud = useHud();
  const queryClient = useQueryClient();
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const { timezone, currency } = params;
  const slotIds = params.slotIds.split(",");
  const hours = hoursSpan(params.startsAt, params.endsAt, timezone, t);
  const title = t("screens.closeTime.title");

  const close = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/slots/block", {
        params: { path: { venueId } },
        body: { slotIds, ...(note.trim() ? { note: note.trim() } : {}) },
      }),
    );
    if (!result.ok) {
      setSending(false);
      hud.show(hudMessage(result.error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] });
    router.back();
  };

  return (
    <Screen
      footer={
        <BottomBar
          title={t("screens.closeTime.bar", { hours })}
          detail={t("screens.closeTime.barBody")}
        >
          <BarButton
            label={t("screens.closeTime.close")}
            primary
            busy={sending}
            onPress={() => void close()}
          />
        </BottomBar>
      }
    >
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={t("screens.closeTime.subtitle")}
        >
          {title}
        </Title>

        {/* The time picked, with the way back to change it. */}
        <View className="mb-6 flex-row items-center rounded-xl border border-dashed border-primary bg-[#f2f4ff] px-4 py-3">
          <View className="flex-1">
            <Text className="text-body">
              {t("screens.book.time", {
                day: relativeDay(localDateOf(params.startsAt, timezone), now, timezone, t),
                hours,
                ground: params.ground,
              })}
            </Text>
            <Text className="text-caption text-ink-2">
              {t("screens.closeTime.detail", {
                count: slotIds.length,
                price: moneyOf(Number(params.price), currency),
              })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={8}
            className="ms-3 active:opacity-70"
          >
            <Text className="text-body font-medium underline">{t("screens.book.change")}</Text>
          </Pressable>
        </View>

        <Field
          label={t("screens.closeTime.note")}
          value={note}
          onChangeText={setNote}
          placeholder={t("screens.calendar.timeSheet.notePlaceholder")}
          maxLength={200}
        />
      </FadingScroll>
    </Screen>
  );
}

export default guarded(RULES.closeTime, CloseTime);
