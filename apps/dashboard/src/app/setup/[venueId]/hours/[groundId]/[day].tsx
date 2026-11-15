import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, View } from "react-native";
import { Button } from "@/components/button";
import { Segmented } from "@/components/choices";
import { HoursDial } from "@/components/hours-dial";
import { useHud } from "@/components/hud";
import { SetupLoading } from "@/components/setup-loading";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { TierRows } from "@/components/tier-rows";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import type { Ground } from "@/lib/grounds";
import {
  CLOSED,
  dayName,
  defaultDiscount,
  defaultPeak,
  limitsOf,
  moveInside,
  moveOpen,
  rangeLabel,
  weekFromApi,
  weekToApi,
  withDiscount,
  withOpen,
  withPeak,
  type DayHours,
  type Range,
  type Week,
} from "@/lib/hours";
import { queries } from "@/lib/queries";

// Changing one day (Figma "Hours · Day C Drag a dial", 375:2): choose what's being changed (when
// it's open, its peak hours, its discounted hours), then drag that stretch's white handles round the
// dial, a whole hour at a time. Open can't run into the days either side; peak and discount stay
// inside the open hours and never overlap, the one being dragged winning.
//
// Save sends the whole week (the API takes weeks, not days) and comes back to it.
type Mode = "OPEN" | "PEAK" | "DISCOUNT";
const MODES: Mode[] = ["OPEN", "PEAK", "DISCOUNT"];
// A closed day opened with nothing to copy from.
const EVENING: Range = { start: 16, end: 24 };

const sameRange = (a: Range | null, b: Range | null) =>
  a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end);
const sameDay = (a: DayHours, b: DayHours) =>
  sameRange(a.open, b.open) && sameRange(a.peak, b.peak) && sameRange(a.discount, b.discount);

export default function DayHoursScreen() {
  const {
    venueId = "",
    groundId = "",
    day = "0",
  } = useLocalSearchParams<{ venueId: string; groundId: string; day: string }>();
  const grounds = useQuery(queries.grounds(venueId));
  const schedule = useQuery(queries.schedule(venueId, groundId));
  if (!grounds.data) return <SetupLoading query={grounds} />;
  if (!schedule.data) return <SetupLoading query={schedule} />;
  const ground = grounds.data.find((g) => g.id === groundId);
  const dayOfWeek = Number(day);
  if (!ground || !(dayOfWeek >= 0 && dayOfWeek <= 6)) return <SetupLoading query={grounds} />;
  return (
    <DayEditor
      venueId={venueId}
      ground={ground}
      dayOfWeek={dayOfWeek}
      week={weekFromApi(schedule.data)}
    />
  );
}

function DayEditor({
  venueId,
  ground,
  dayOfWeek,
  week,
}: {
  venueId: string;
  ground: Ground;
  dayOfWeek: number;
  week: Week;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const saved = week[dayOfWeek] ?? CLOSED;
  const [hours, setHours] = useState<DayHours>(saved);
  const [mode, setMode] = useState<Mode>("OPEN");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const limits = limitsOf(week, dayOfWeek);
  const name = ground.name ?? t("screens.setup.grounds.unnamed");
  const day = dayName(t, dayOfWeek);
  const { open } = hours;

  // What the handles are on, for the mode, and the price it needs.
  const stretch = mode === "PEAK" ? hours.peak : mode === "DISCOUNT" ? hours.discount : open;
  const priced =
    mode === "PEAK"
      ? ground.peakPrice !== null
      : mode === "DISCOUNT"
        ? ground.discountPrice !== null
        : true;
  const handles = stretch && priced ? [stretch.start % 24, stretch.end % 24] : [];

  const move = (handle: number, clock: number) => {
    const edge = handle === 0 ? "start" : "end";
    if (!open) return;
    if (mode === "OPEN") {
      const next = moveOpen(open, edge, clock, limits);
      if (next) setHours(withOpen(hours, next));
      return;
    }
    const current = mode === "PEAK" ? hours.peak : hours.discount;
    if (!current) return;
    const next = moveInside(current, edge, clock, open);
    if (!next) return;
    setHours(mode === "PEAK" ? withPeak(hours, next) : withDiscount(hours, next));
  };

  // Opening a closed day: the nearest earlier day's hours if they fit, otherwise the evening.
  const openDay = () => {
    const fits = (range: Range) => range.start >= limits.min && range.end <= limits.max;
    for (let back = 1; back < 7; back += 1) {
      const earlier = week[(dayOfWeek + 7 - back) % 7]?.open;
      if (earlier && fits(earlier)) return setHours({ open: earlier, peak: null, discount: null });
    }
    const evening = fits(EVENING)
      ? EVENING
      : { start: limits.min, end: Math.min(limits.min + 8, limits.max) };
    setHours({ open: evening, peak: null, discount: null });
  };

  const save = async () => {
    const next = week.map((d, i) => (i === dayOfWeek ? hours : d));
    setSaving(true);
    const result = await send(
      api.PUT("/v1/staff/venues/{venueId}/grounds/{groundId}/schedule", {
        params: { path: { venueId, groundId: ground.id } },
        body: { days: weekToApi(next) },
      }),
    );
    if (!result.ok) {
      setSaving(false);
      return hud.show(hudMessage(result.error));
    }
    queryClient.setQueryData(queries.schedule(venueId, ground.id).queryKey, result.data.days);
    // The ground's open hours, the checklist and the draft card all follow.
    void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
    router.back();
  };

  const centre = () => {
    if (!open)
      return { title: t("screens.setup.hours.closed"), detail: t("screens.setup.hours.openFirst") };
    if (!priced) return { title: rangeLabel(t, open), detail: " " };
    if (!stretch) return { title: rangeLabel(t, open), detail: " " };
    return { title: rangeLabel(t, stretch), detail: t("screens.setup.hours.dragHandles") };
  };
  const { title, detail } = centre();

  return (
    <StepScreen
      title={day}
      subtitle={t("screens.setup.hours.daySubtitle")}
      scrollEnabled={!dragging}
      footer={
        <Button
          label={t("screens.setup.hours.save")}
          disabled={sameDay(hours, saved)}
          loading={saving}
          onPress={() => void save()}
        />
      }
    >
      <Segmented
        options={MODES}
        value={mode}
        label={(option) =>
          t(
            option === "OPEN"
              ? "screens.setup.hours.open"
              : option === "PEAK"
                ? "screens.setup.hours.peak"
                : "screens.setup.hours.discount",
          )
        }
        onChange={setMode}
      />
      <View className="items-center pt-6">
        <HoursDial
          size={300}
          day={hours}
          title={title}
          detail={detail}
          handles={handles}
          onHandleMove={move}
          onDragChange={setDragging}
        />
      </View>

      {mode === "OPEN" ? (
        // Open or closed, as a switch under the dial.
        <View className="mt-4 flex-row items-center gap-4 border-y border-border py-3.5">
          <Text className="flex-1 text-subtitle font-medium">
            {t("screens.setup.hours.openThisDay", { day })}
          </Text>
          <Switch
            value={open !== null}
            onValueChange={(on) => (on ? openDay() : setHours(CLOSED))}
            trackColor={{ true: colors.primary, false: colors.border }}
            ios_backgroundColor={colors.border}
          />
        </View>
      ) : (
        <>
          <TierRows day={hours} tiers={["PEAK", "DISCOUNT"]} />
          <StretchAction
            mode={mode}
            hours={hours}
            priced={priced}
            name={name}
            onAdd={() => {
              if (!open) return;
              setHours(
                mode === "PEAK"
                  ? withPeak(hours, defaultPeak(open))
                  : withDiscount(hours, defaultDiscount(open)),
              );
            }}
            onRemove={() =>
              setHours(mode === "PEAK" ? withPeak(hours, null) : withDiscount(hours, null))
            }
          />
        </>
      )}
    </StepScreen>
  );
}

// Under the rows in Peak or Discount: add the stretch, take it off, or say why it can't be marked
// (the day's closed, or the ground has no price for it).
function StretchAction({
  mode,
  hours,
  priced,
  name,
  onAdd,
  onRemove,
}: {
  mode: "PEAK" | "DISCOUNT";
  hours: DayHours;
  priced: boolean;
  name: string;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const peak = mode === "PEAK";
  if (!hours.open || !priced) {
    return (
      <Text className="mt-4 text-label leading-[1.43] text-ink-2">
        {!hours.open
          ? t("screens.setup.hours.openFirst")
          : t(peak ? "screens.setup.hours.noPeakPrice" : "screens.setup.hours.noDiscountPrice", {
              name,
            })}
      </Text>
    );
  }
  const has = peak ? hours.peak !== null : hours.discount !== null;
  const label = has
    ? t(peak ? "screens.setup.hours.removePeak" : "screens.setup.hours.removeDiscount")
    : t(peak ? "screens.setup.hours.addPeak" : "screens.setup.hours.addDiscount");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={has ? onRemove : onAdd}
      hitSlop={8}
      className="mt-5 self-start active:opacity-60"
    >
      <Text className="text-subtitle font-medium underline">{label}</Text>
    </Pressable>
  );
}
