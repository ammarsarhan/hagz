import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useRef, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { intlLocale, isRTL } from "@/lib/language";
import { datesLabel } from "@/lib/regulars";
import { BarButton, BottomBar } from "./bottom-bar";
import { useHud } from "./hud";
import {
  IconChevronRight,
  IconClock,
  IconLink,
  IconPlayerPause,
  IconPlayerPlay,
  IconSquare,
} from "./icons";
import { Sheet } from "./sheet";
import { StepRail, type Step } from "./step-rail";
import { Text } from "./text";

// A regular's ⋯ and what it leads to (Figma D12 655:111, 655:233).
//
// - RegularMenu: "Youssef's weekly game", then a row for each thing to do, each with what it does
//   in grey: Change the time, Pause (Resume when paused), Copy a confirm link, End the weekly game.
// - StateSheet: Pause or End asked first, what follows on the step rail (the confirmed weeks stay,
//   the waiting ones go back on sale, then resume any time, or not at all), the button in a bar.
//   End has no frame of its own: it's Pause's sheet with End's words.

type Detail = components["schemas"]["VenueRegularDetail"];
type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
export type RegularAction = "change" | "pause" | "resume" | "link" | "end";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function RegularMenu({
  regular,
  visible,
  onClose,
  onHidden,
  onPick,
}: {
  regular: Detail;
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
  onPick: (action: RegularAction) => void;
}) {
  const { t } = useTranslation();
  const m = "screens.regulars.menu";
  const paused = regular.status === "PAUSED";
  const rows: { action: RegularAction; icon: Icon; title: string; body: string }[] = [
    { action: "change", icon: IconClock, title: t(`${m}.change`), body: t(`${m}.changeBody`) },
    paused
      ? {
          action: "resume",
          icon: IconPlayerPlay,
          title: t(`${m}.resume`),
          body: t(`${m}.resumeBody`),
        }
      : {
          action: "pause",
          icon: IconPlayerPause,
          title: t(`${m}.pause`),
          body: t(`${m}.pauseBody`),
        },
    { action: "link", icon: IconLink, title: t(`${m}.link`), body: t(`${m}.linkBody`) },
    { action: "end", icon: IconSquare, title: t(`${m}.end`), body: t(`${m}.endBody`) },
  ];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-3 text-[22px] font-semibold leading-[1.27]">
        {t(`${m}.title`, { name: firstName(regular.customer.name) })}
      </Text>
      {rows.map((row, index) => (
        <Pressable
          key={row.action}
          accessibilityRole="button"
          onPress={() => onPick(row.action)}
          className={`flex-row items-center py-2.5 active:opacity-60 ${index < rows.length - 1 ? "border-b border-border" : ""}`}
        >
          <View className="size-10 items-center justify-center rounded-full bg-chip">
            <row.icon size={20} color={colors.ink} strokeWidth={2} />
          </View>
          <View className="ms-3.5 flex-1">
            <Text className="text-[16px] leading-[21px] font-medium">{row.title}</Text>
            <Text className="text-[14px] leading-[19px] text-ink-2">{row.body}</Text>
          </View>
          <IconChevronRight
            size={18}
            color={colors.unit}
            strokeWidth={2}
            style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </Pressable>
      ))}
    </Sheet>
  );
}

// Pause or End, asked first. Done, it closes and the page shows the regular as it now is.
export function StateSheet({
  regular,
  action,
  venueId,
  timezone,
  visible,
  onClose,
  onHidden,
}: {
  regular: Detail;
  action: "pause" | "end";
  venueId: string;
  timezone: string;
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const done = useAfterRegular(venueId, regular.id);
  const [sending, setSending] = useState(false);
  const s = `screens.regulars.${action}` as const;
  const name = firstName(regular.customer.name);
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const datesOf = (status: "CONFIRMED" | "UNCONFIRMED") =>
    regular.reservations
      .filter((booking) => booking.status === status)
      .map((booking) => dateOf.format(new Date(booking.startsAt)));
  const confirmed = datesOf("CONFIRMED");
  const waiting = datesOf("UNCONFIRMED");

  const steps: Step[] = [
    ...(confirmed.length > 0
      ? [
          {
            label: t(`screens.regulars.pause.stays`, {
              count: confirmed.length,
              dates: withWeekday(t, confirmed),
            }),
            detail: t("screens.regulars.pause.staysBody"),
            when: "",
            state: "done" as const,
            bold: "label" as const,
          },
        ]
      : []),
    ...(waiting.length > 0
      ? [
          {
            label: t(`screens.regulars.pause.backOnSale`, {
              count: waiting.length,
              dates: withWeekday(t, waiting),
            }),
            detail: t("screens.regulars.pause.notCounted", { name }),
            when: "",
            state: "now" as const,
            bold: "label" as const,
          },
        ]
      : []),
    { label: t(`${s}.after`), detail: t(`${s}.afterBody`), when: "", state: "next" },
  ];

  const run = async () => {
    setSending(true);
    const path = { params: { path: { venueId, regularId: regular.id } } };
    const result = await send(
      action === "pause"
        ? api.POST("/v1/staff/venues/{venueId}/regulars/{regularId}/pause", path)
        : api.POST("/v1/staff/venues/{venueId}/regulars/{regularId}/end", path),
    );
    await done(result.ok ? result.data : undefined);
    setSending(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-6 text-[22px] font-semibold leading-[1.27]">
        {t(`${s}.title`, { name })}
      </Text>
      <StepRail gap={22} steps={steps} />
      <View className="mt-8 pt-3">
        <BottomBar
          title={
            waiting.length > 0
              ? t("screens.regulars.pause.barTitle", { count: waiting.length })
              : t(`${s}.barTitlePlain`)
          }
          detail={t(`${s}.barBody`)}
        >
          <BarButton label={t(`${s}.button`)} primary busy={sending} onPress={() => void run()} />
        </BottomBar>
      </View>
    </Sheet>
  );
}

// After pausing, resuming or ending: the page takes the answer, and the lists and calendar that show
// its weeks are read again.
export const useAfterRegular = (venueId: string, regularId: string) => {
  const queryClient = useQueryClient();
  return (answer?: Detail) => {
    if (answer)
      queryClient.setQueryData(["staff", "venues", venueId, "regulars", regularId], answer);
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["staff", "venues", venueId, "regulars"],
        exact: true,
      }),
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] }),
    ]);
  };
};

// "Tue 1 and 8 Dec": the weekday once, then the dates.
const withWeekday = (t: TFunction, dates: string[]) => {
  const first = dates[0];
  if (!first) return "";
  const weekday = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "short" });
  return `${weekday.format(new Date(`${first}T12:00:00Z`))} ${datesLabel(t, dates)}`;
};

// For the page's Resume, in its bar.
export function useResume(venueId: string, regularId: string) {
  const hud = useHud();
  const done = useAfterRegular(venueId, regularId);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const resume = async () => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/regulars/{regularId}/resume", {
        params: { path: { venueId, regularId } },
      }),
    );
    await done(result.ok ? result.data : undefined);
    busy.current = false;
    setSending(false);
    if (!result.ok) hud.show(hudMessage(result.error));
  };
  return { resume, sending };
}
