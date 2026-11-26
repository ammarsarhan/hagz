import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useRef, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { intlLocale } from "@/lib/language";
import { hourLabel } from "@/lib/hours";
import { datesLabel } from "@/lib/regulars";
import { BarButton, BottomBar } from "./bottom-bar";
import { useHud } from "./hud";
import { IconClock, IconLink, IconPlayerPause, IconPlayerPlay, IconSquare } from "./icons";
import { SettingsRow } from "./settings-row";
import { Sheet } from "./sheet";
import { StepRail, type Step } from "./step-rail";
import { Text } from "./text";

// A regular's ⋯ and what it leads to (Figma D12 655:111, 655:233).
//
// - RegularMenu: as the customer app's photo sheet, "Modify game" small and centred, then a row for each thing to do, each with what it does
//   in grey: Change the time, Pause (Resume when paused), Copy a confirm link, End the weekly game.
// - StateSheet: Pause or End asked first, what follows on the step rail (the confirmed weeks stay,
//   the waiting ones go back on sale, then resume any time, or not at all), the button in a bar.
//   End has no frame of its own: it's Pause's sheet with End's words.
// - MoveSheet (656:158): after picking the new time on Select day, what moves and what stays, Move
//   in the bar. The server tells nobody, so the frame's "Youssef is told once" isn't said.

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
  // As the customer app's photo sheet (user, 2026-11-26): no close button, a small title centred
  // over settings rows, each one's icon at its end.
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
      closeButton={false}
    >
      <Text
        accessibilityRole="header"
        className="mt-2 mb-4 text-center text-[17px] leading-[23px] font-semibold"
      >
        {t(`${m}.title`)}
      </Text>
      <View>
        {rows.map((row, index) => (
          <SettingsRow
            key={row.action}
            title={row.title}
            body={row.body}
            leading={<row.icon size={20} color={colors.ink} strokeWidth={1.75} />}
            onPress={() => onPick(row.action)}
            divider={index < rows.length - 1}
          />
        ))}
      </View>
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
  // Once it has slid away; with the regular as it now is, when it was paused or ended.
  onHidden?: (changed?: Detail) => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const done = useAfterRegular(venueId, regular.id);
  const [sending, setSending] = useState(false);
  // The answer, kept until the sheet has gone: applied sooner, the sheet would show the regular as
  // it now is while it slides down (user, 2026-11-26).
  const changed = useRef<Detail | null>(null);
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
    setSending(false);
    if (!result.ok) {
      void done();
      hud.show(hudMessage(result.error));
      return;
    }
    changed.current = result.data;
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => {
        const answer = changed.current ?? undefined;
        changed.current = null;
        if (answer) void done(answer);
        onHidden?.(answer);
      }}
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
      // The list, and every other regular's page: weeks it let go or took back went to them
      // (user, 2026-11-26: #2 still said skipped after #1 paused). Its own is set just above.
      queryClient.invalidateQueries({
        queryKey: ["staff", "venues", venueId, "regulars"],
        predicate: (query) => query.queryKey[4] !== regularId,
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

export interface NewTime {
  groundId: string;
  ground: string;
  dayOfWeek: number;
  startHour: number;
  slotCount: number;
  // "600 EGP".
  price: string;
  // The weeks ahead at the new time: free ones it gets, taken ones tried again daily.
  free: string[];
  taken: string[];
}

type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";

// Moving a regular to a new time, asked first. Done, it closes, then `onMoved` (back to its page).
export function MoveSheet({
  regular,
  to,
  venueId,
  timezone,
  visible,
  onClose,
  onMoved,
}: {
  regular: Detail;
  to: NewTime;
  venueId: string;
  timezone: string;
  visible: boolean;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const done = useAfterRegular(venueId, regular.id);
  const [sending, setSending] = useState(false);
  // The answer, kept until the sheet has gone (as StateSheet's).
  const moved = useRef<Detail | null>(null);
  const c = "screens.regulars.change";
  const name = firstName(regular.customer.name);
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const datesOf = (status: "CONFIRMED" | "UNCONFIRMED") =>
    regular.reservations
      .filter((booking) => booking.status === status)
      .map((booking) => dateOf.format(new Date(booking.startsAt)));
  const confirmed = datesOf("CONFIRMED");
  const waiting = datesOf("UNCONFIRMED");
  const day = t(`screens.regulars.days.${String(to.dayOfWeek) as Weekday}`);

  const steps: Step[] = [
    ...(confirmed.length > 0
      ? [
          {
            label: t("screens.regulars.pause.stays", {
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
    {
      label:
        to.free.length === 0
          ? t(`${c}.noneFree`)
          : waiting.length > 0
            ? t(`${c}.moves`, {
                count: waiting.length,
                from: datesLabel(t, waiting),
                to: withWeekday(t, to.free),
              })
            : t(`${c}.reserved`, { dates: withWeekday(t, to.free) }),
      detail: waiting.length > 0 ? t("screens.regulars.pause.notCounted", { name }) : undefined,
      when: "",
      state: "now" as const,
      bold: "label" as const,
    },
    ...(to.taken.length > 0
      ? [
          {
            label: t(`${c}.taken`, { count: to.taken.length, dates: withWeekday(t, to.taken) }),
            detail: t(`${c}.takenBody`),
            when: "",
            state: "maybe" as const,
          },
        ]
      : []),
  ];

  const move = async () => {
    setSending(true);
    const result = await send(
      api.PATCH("/v1/staff/venues/{venueId}/regulars/{regularId}", {
        params: { path: { venueId, regularId: regular.id } },
        body: {
          groundId: to.groundId,
          dayOfWeek: to.dayOfWeek,
          startHour: to.startHour,
          slotCount: to.slotCount,
        },
      }),
    );
    setSending(false);
    if (!result.ok) {
      void done();
      hud.show(hudMessage(result.error));
      return;
    }
    moved.current = result.data;
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => {
        const answer = moved.current;
        moved.current = null;
        if (!answer) return;
        void done(answer);
        onMoved();
      }}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-6 text-[22px] font-semibold leading-[1.27]">
        {t(`${c}.sheetTitle`, { day, hour: hourLabel(t, to.startHour) })}
      </Text>
      <StepRail gap={22} steps={steps} />
      <View className="mt-8 pt-3">
        <BottomBar
          title={t("screens.regulars.confirm.time", {
            day,
            hours: `${hourLabel(t, to.startHour)} – ${hourLabel(t, to.startHour + to.slotCount)}`,
          })}
          detail={[to.ground, to.price].filter(Boolean).join(" · ")}
        >
          <BarButton label={t(`${c}.button`)} primary busy={sending} onPress={() => void move()} />
        </BottomBar>
      </View>
    </Sheet>
  );
}
