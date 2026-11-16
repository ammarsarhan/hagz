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
import { GroupHeading } from "./group-heading";
import { useHud } from "./hud";
import { IconCheck } from "./icons";
import { CloseButton, NavBar } from "./nav";
import { Screen } from "./screen";
import { Text } from "./text";
import { Title } from "./title";

type VenueSetup = components["schemas"]["VenueSetup"];

// A venue sent for review (Figma "Setup · In review", 363:2): where it is in the review as three
// steps, what waits on it, and the way back to editing. Nothing can change while it's in review
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
  const name = setup.venue.name ?? t("screens.setup.untitled");

  // Back to a draft: the screen becomes the checklist again, everything editable.
  const withdraw = async () => {
    setWithdrawing(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/withdraw", { params: { path: { venueId } } }),
    );
    setWithdrawing(false);
    if (!result.ok) return hud.show(hudMessage(result.error));
    queryClient.setQueryData(queries.setup(venueId).queryKey, result.data);
    void afterVenueWrite(queryClient, venueId, { checklist: false });
  };

  return (
    <Screen>
      <NavBar start={<CloseButton label={t("components.shared.nav.close")} onPress={onClose} />} />
      <FadingScroll>
        <Title subtitle={t("screens.setup.review.inReview")}>{name}</Title>

        <View className="mt-2">
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

        <GroupHeading className="mb-1 mt-8">{t("screens.setup.review.whileYouWait")}</GroupHeading>
        <Waiting
          title={t("screens.setup.review.inviteStaff")}
          detail={t("screens.setup.review.inviteStaffBody", { name })}
        />
        <Waiting
          title={t("screens.setup.review.yourSetup")}
          detail={t("screens.setup.review.yourSetupBody")}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => void withdraw()}
          disabled={withdrawing}
          hitSlop={10}
          className="mt-6 items-center self-center active:opacity-60"
        >
          <Text
            className={`text-subtitle font-medium underline ${withdrawing ? "text-ink-3" : "text-ink"}`}
          >
            {t("screens.setup.review.withdraw")}
          </Text>
        </Pressable>
      </FadingScroll>
    </Screen>
  );
}

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
  return (
    <View className="flex-row gap-3.5">
      <View className="items-center" style={{ width: 22 }}>
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
        {last ? null : <View className="w-px flex-1 bg-hairline" style={{ minHeight: 20 }} />}
      </View>
      <View className={`flex-1 ${last ? "" : "pb-4"}`}>
        <Text className={`text-subtitle leading-[1.375] ${pending ? "text-ink-2" : "font-medium"}`}>
          {title}
        </Text>
        {detail ? (
          <Text className={`text-label ${pending ? "text-ink-3" : "text-ink-2"}`}>{detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

// Something that waits on the review: shown, but pale, since there's nothing to do with it yet.
function Waiting({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="border-b border-border py-3.5">
      <Text className="text-subtitle text-ink-2">{title}</Text>
      <Text className="mt-0.5 text-label text-ink-3">{detail}</Text>
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
