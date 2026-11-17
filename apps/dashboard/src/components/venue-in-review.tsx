import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { language } from "@/lib/language";
import { afterVenueWrite, queries } from "@/lib/queries";
import { FadingScroll } from "./fading-scroll";
import { Button } from "./button";
import { useHud } from "./hud";
import { IconCheck } from "./icons";
import { CloseButton, NavBar } from "./nav";
import { Screen } from "./screen";
import { Sheet } from "./sheet";
import { Text } from "./text";
import { Title } from "./title";

type VenueSetup = components["schemas"]["VenueSetup"];

// A venue sent for review (Figma "Setup · In review", 363:2): where it is in the review as three
// steps, and the way back to editing (Withdraw, which asks first). Nothing can change while it's in review
// (the API refuses), so the checklist gives way to this until it's approved, sent back or
// withdrawn.
export function VenueInReview({
  venueId,
  setup,
  onClose,
}: {
  venueId: string;
  setup: VenueSetup;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [withdrawing, setWithdrawing] = useState(false);
  // Withdrawing asks first: it ends the review, and sending again starts a new one.
  const [confirming, setConfirming] = useState(false);
  const name = setup.venue.name ?? t("screens.setup.untitled");

  // Back to a draft: the screen becomes the checklist again, everything editable.
  const withdraw = async () => {
    setWithdrawing(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/withdraw", { params: { path: { venueId } } }),
    );
    setWithdrawing(false);
    if (!result.ok) return hud.show(hudMessage(result.error));
    setConfirming(false);
    queryClient.setQueryData(queries.setup(venueId).queryKey, result.data);
    void afterVenueWrite(queryClient, venueId, { checklist: false });
  };

  return (
    <Screen
      footer={
        <Button
          label={t("screens.setup.review.withdraw")}
          variant="soft"
          onPress={() => setConfirming(true)}
        />
      }
    >
      <NavBar start={<CloseButton label={t("components.shared.nav.close")} onPress={onClose} />} />
      <FadingScroll>
        <Title subtitle={t("screens.setup.review.inReview")}>
          {t("screens.setup.review.submittedTitle", { venue: name })}
        </Title>

        <View className="mt-4">
          <Step
            state="done"
            title={t("screens.setup.review.sent")}
            detail={setup.venue.submittedAt ? sentAt(setup.venue.submittedAt, t) : ""}
          />
          <Step
            state="now"
            title={t("screens.setup.review.checking")}
            detail={t("screens.setup.review.checkingBody")}
          />
          <Step
            state="next"
            title={t("screens.setup.review.live")}
            detail={t("screens.setup.review.liveBody")}
            last
          />
        </View>
      </FadingScroll>

      <Sheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        closeLabel={t("components.shared.nav.close")}
      >
        <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
          {t("screens.setup.review.withdrawTitle")}
        </Text>
        <Text className="mb-6 mt-1.5 text-body text-ink-2">
          {t("screens.setup.review.withdrawBody")}
        </Text>
        <Button
          label={t("screens.setup.review.withdraw")}
          variant="soft"
          loading={withdrawing}
          onPress={() => void withdraw()}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirming(false)}
          className="items-center py-4 active:opacity-60"
        >
          <Text className="text-subtitle font-medium">
            {t("screens.setup.review.keepInReview")}
          </Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}

// How far a step's mark sits below the middle of its title's line, in points.
const MARK_NUDGE = 2;

// One step of the review: done (a filled tick), happening now (a ring with a dot), or still to
// come (a pale ring, its words pale too), joined by a line down to the next.
function Step({
  state,
  title,
  detail,
  last = false,
}: {
  state: "done" | "now" | "next";
  title: string;
  detail: string;
  last?: boolean;
}) {
  const pending = state === "next";
  // The mark and the title share a row, centred on each other, so the mark sits on the title's line
  // whatever the line height does (iOS puts a tall line's extra space above the text). Centred on
  // the line, it still reads high next to mostly lowercase words, so it's nudged down onto them.
  // The detail and the line down to the next step go under it.
  return (
    <View>
      <View className="flex-row items-center gap-3.5">
        <View style={{ transform: [{ translateY: MARK_NUDGE }] }}>
          {state === "done" ? (
            <View className="size-[22px] items-center justify-center rounded-full bg-ink">
              <IconCheck size={14} color={colors.white} strokeWidth={3} />
            </View>
          ) : state === "now" ? (
            <View className="size-[22px] items-center justify-center rounded-full border-2 border-ink">
              <View className="size-2 rounded-full bg-ink" />
            </View>
          ) : (
            <View className="size-[22px] rounded-full border-[1.5px] border-hairline" />
          )}
        </View>
        <Text
          className={`flex-1 text-subtitle leading-[1.375] ${pending ? "text-ink-2" : "font-medium"}`}
        >
          {title}
        </Text>
      </View>
      <View className="flex-row gap-3.5">
        <View className="items-center" style={{ width: 22 }}>
          {last ? null : (
            <View className="my-1 w-px flex-1 bg-hairline" style={{ minHeight: 28 }} />
          )}
        </View>
        <View className={`flex-1 ${last ? "" : "pb-7"}`}>
          {detail ? (
            <Text className={`text-label ${pending ? "text-ink-3" : "text-ink-2"}`}>{detail}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// "Today, 4:12 pm", "Yesterday, 9:05 am", "14 Nov, 6:30 pm", with Western digits in Arabic too.
const locale = `${language}-u-nu-latn`;
const sentAt = (iso: string, t: TFunction) => {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(at);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - at.getTime()) / 86_400_000) + 1;
  if (at >= startOfToday) return t("screens.setup.review.today", { time });
  if (days === 1) return t("screens.setup.review.yesterday", { time });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(at);
  return t("screens.setup.review.on", { date, time });
};
