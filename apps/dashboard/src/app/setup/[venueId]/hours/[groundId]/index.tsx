import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Button } from "@/components/button";
import { HoursDial } from "@/components/hours-dial";
import { useHud } from "@/components/hud";
import { IconCheck, IconClock, IconLayoutGrid } from "@/components/icons";
import { RoundButton } from "@/components/nav";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { TierRows } from "@/components/tier-rows";
import { ChartKey, WeekChart } from "@/components/week-chart";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { kindOf, type Ground } from "@/lib/grounds";
import { dayLetter, dayName, length, rangeLabel, weekFromApi, type Week } from "@/lib/hours";
import { queries } from "@/lib/queries";

// A ground's week (Figma "Hours · Week A Dial per day", 370:2): one day at a time on the dial,
// picked from the letters above it, with its kinds of hours listed under it. Tapping the dial opens
// the day to change it. The round button by the back button swaps to the whole week as a chart
// ("Hours · Week C Week at a glance", 372:2) and back.
//
// Each day is saved from its own screen, so Done only leaves. With other grounds to share them
// with, the hours can be copied to them (the sheet, "Hours · Copy to other grounds", 357:2).
type Mode = "dial" | "chart";

export default function GroundHours() {
  const { venueId = "", groundId = "" } = useLocalSearchParams<{
    venueId: string;
    groundId: string;
  }>();
  const grounds = useQuery(queries.grounds(venueId));
  const schedule = useQuery(queries.schedule(venueId, groundId));
  if (!grounds.data) return <SetupLoading query={grounds} />;
  if (!schedule.data) return <SetupLoading query={schedule} />;
  const ground = grounds.data.find((g) => g.id === groundId);
  if (!ground) return <SetupLoading query={grounds} />;
  return (
    <WeekScreen
      venueId={venueId}
      ground={ground}
      others={grounds.data.filter((g) => g.id !== groundId)}
      week={weekFromApi(schedule.data)}
    />
  );
}

function WeekScreen({
  venueId,
  ground,
  others,
  week,
}: {
  venueId: string;
  ground: Ground;
  others: Ground[];
  week: Week;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<Mode>("dial");
  // Today, to start with: the day an owner is most likely checking.
  const [selected, setSelected] = useState(() => new Date().getDay());
  const [copying, setCopying] = useState(false);
  const name = ground.name ?? t("screens.setup.grounds.unnamed");
  const day = week[selected] ?? week[0];
  const open = (dayOfWeek: number) =>
    router.push(`/setup/${venueId}/hours/${ground.id}/${dayOfWeek}`);
  const anyOpen = week.some((d) => d.open);

  return (
    <StepScreen
      title={t("screens.setup.hours.title")}
      subtitle={t(
        view === "dial" ? "screens.setup.hours.weekSubtitle" : "screens.setup.hours.chartSubtitle",
        { name },
      )}
      navEnd={
        <RoundButton
          icon={view === "dial" ? IconLayoutGrid : IconClock}
          label={t(
            view === "dial" ? "screens.setup.hours.showChart" : "screens.setup.hours.showDial",
          )}
          onPress={() => setView(view === "dial" ? "chart" : "dial")}
        />
      }
      footer={<Button label={t("screens.setup.hours.done")} onPress={() => router.back()} />}
    >
      {view === "dial" && day ? (
        <>
          <View accessibilityRole="tablist" className="flex-row justify-between pb-[18px]">
            {week.map((d, dayOfWeek) => {
              const chosen = dayOfWeek === selected;
              return (
                <Pressable
                  key={dayOfWeek}
                  accessibilityRole="tab"
                  accessibilityLabel={dayName(t, dayOfWeek)}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => setSelected(dayOfWeek)}
                  className={`size-[42px] items-center justify-center rounded-full border ${chosen ? "border-ink bg-ink" : "border-border"}`}
                >
                  {/* A closed day's letter is quieter. */}
                  <Text
                    className={`text-body font-medium ${chosen ? "text-white" : d.open ? "" : "text-ink-3"}`}
                  >
                    {dayLetter(t, dayOfWeek)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dayName(t, selected)}
            onPress={() => open(selected)}
            className="items-center active:opacity-70"
          >
            <HoursDial
              size={280}
              day={day}
              title={day.open ? rangeLabel(t, day.open) : t("screens.setup.hours.closed")}
              detail={
                day.open
                  ? t("screens.setup.hours.hoursOpen", { count: length(day.open) })
                  : t("screens.setup.hours.tapToOpen")
              }
            />
          </Pressable>
          <TierRows day={day} />
        </>
      ) : (
        <>
          <WeekChart week={week} onDay={open} />
          <ChartKey />
        </>
      )}

      {others.length > 0 && anyOpen ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCopying(true)}
          hitSlop={8}
          className="mt-6 self-start active:opacity-60"
        >
          <Text className="text-subtitle font-medium underline">
            {t("screens.setup.hours.copy")}
          </Text>
        </Pressable>
      ) : null}

      <CopySheet
        visible={copying}
        venueId={venueId}
        ground={ground}
        name={name}
        others={others}
        onClose={() => setCopying(false)}
      />
    </StepScreen>
  );
}

// Copying a ground's week to others (Figma 357:2): a one-time copy, not a link; each keeps its own
// prices. The API refuses the lot if one of them lacks a price the week uses.
function CopySheet({
  visible,
  venueId,
  ground,
  name,
  others,
  onClose,
}: {
  visible: boolean;
  venueId: string;
  ground: Ground;
  name: string;
  others: Ground[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const copy = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/grounds/{groundId}/schedule/copy", {
        params: { path: { venueId, groundId: ground.id } },
        body: { groundIds: [...picked] },
      }),
    );
    setSending(false);
    if (!result.ok) return hud.show(hudMessage(result.error));
    void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => setPicked(new Set())}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.setup.hours.copyTitle", { name })}
      </Text>
      <Text className="mb-4 mt-3 text-subtitle text-ink-2">
        {t("screens.setup.hours.copyBody", { name })}
      </Text>
      <View className="border-t border-border">
        {others.map((other) => {
          const checked = picked.has(other.id);
          const otherName = other.name ?? t("screens.setup.grounds.unnamed");
          return (
            <Pressable
              key={other.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={otherName}
              onPress={() => toggle(other.id)}
              className="flex-row items-center gap-3 border-b border-border py-[15px] active:opacity-60"
            >
              <View className="flex-1">
                <Text className="text-subtitle font-medium leading-[1.31]">{otherName}</Text>
                <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
                  {`${kindOf(t, other)} · ${t(`screens.setup.grounds.environments.${other.environment}`)}`}
                </Text>
              </View>
              <View
                className={`size-[22px] items-center justify-center rounded-[6px] ${checked ? "bg-primary" : "border-[1.5px] border-border"}`}
              >
                {checked ? <IconCheck size={16} color={colors.white} strokeWidth={2.5} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-6">
        <Button
          label={
            picked.size === 0
              ? t("screens.setup.hours.copyPick")
              : t("screens.setup.hours.copyTo", { count: picked.size })
          }
          disabled={picked.size === 0}
          loading={sending}
          onPress={() => void copy()}
        />
      </View>
    </Sheet>
  );
}
