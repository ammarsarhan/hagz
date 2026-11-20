import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { localDate, type SearchParams, useFreeHours, useVenueCount, type When } from "@/lib/search";
import { Button } from "./button";
import { HourTimeline, runLabel, type Run } from "./hour-timeline";
import { Sheet } from "./sheet";
import { Text } from "./text";

// When to play (Figma "C3 · Tabs & Search": the sheet of option 5, 100:2, with the time picked on
// the timeline of "When sheet" option 4, 122:2; the user's pick on 2026-11-20): the next two weeks
// as day tiles, then the day as a timeline of how many venues are free each hour, with the game's
// run between two handles. The button says how many venues the choice finds before it's applied;
// Clear goes back to today, any time.

const DAYS = 14;
const FIRST_HOUR = 6;

function DayTile({
  date,
  timezone,
  on,
  onPress,
}: {
  date: string;
  timezone: string;
  on: boolean;
  onPress: () => void;
}) {
  const today = date === localDate(timezone);
  const at = new Date(`${date}T12:00:00Z`);
  const weekday = today
    ? "Today"
    : new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-[72px] w-[58px] items-center justify-center gap-0.5 rounded-[14px] ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      <Text className={`text-caption ${on ? "text-white" : "text-ink-2"}`}>{weekday}</Text>
      <Text className={`text-[20px] leading-6 font-medium ${on ? "text-white" : "text-ink"}`}>
        {at.getUTCDate()}
      </Text>
    </Pressable>
  );
}

const runOf = (when: When): Run | null => {
  if (!when.start) return null;
  const from = Number(when.start.slice(0, 2));
  return { from, to: from + when.hours };
};

export function SearchWhen({
  visible,
  when,
  timezone,
  params,
  onApply,
  onClose,
}: {
  visible: boolean;
  when: When;
  timezone: string;
  // The search as it stands without its when, for the timeline's counts and what a choice finds.
  params: SearchParams;
  onApply: (when: When) => void;
  onClose: () => void;
}) {
  // A draft, applied only with the button.
  const [draft, setDraft] = useState(when);
  useEffect(() => {
    if (visible) setDraft(when);
  }, [visible, when]);

  const today = localDate(timezone);
  const date = draft.date ?? today;
  const days = Array.from({ length: DAYS }, (_, i) => localDate(timezone, i));
  const nowHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
  // Today, only the hours still ahead; another day, from 6 am.
  const earliest = date === today ? Math.max(FIRST_HOUR, nowHour + 1) : FIRST_HOUR;
  const run = runOf(draft);

  const counts = useFreeHours({ ...params, ...(draft.date ? { date: draft.date } : {}) }, visible);
  const count = useVenueCount(
    {
      ...params,
      ...(draft.date ? { date: draft.date } : {}),
      ...(draft.start ? { start: draft.start, hours: draft.hours } : {}),
    },
    visible,
  );

  const setRun = (next: Run | null) =>
    setDraft((previous) => ({
      ...previous,
      start: next ? `${String(next.from).padStart(2, "0")}:00` : null,
      hours: next ? next.to - next.from : 1,
    }));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="text-[22px] leading-7 font-semibold">
        When do you want to play?
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-5 -mx-6"
        contentContainerClassName="gap-2 px-6"
      >
        {days.map((day) => (
          <DayTile
            key={day}
            date={day}
            timezone={timezone}
            on={day === date}
            onPress={() =>
              setDraft((previous) => {
                const next = { ...previous, date: day === today ? null : day };
                // A run that's passed on the new day goes back to any time.
                const picked = runOf(previous);
                return day === today && picked && picked.from <= nowHour
                  ? { ...next, start: null, hours: 1 }
                  : next;
              })
            }
          />
        ))}
      </ScrollView>

      <View className="mt-8 flex-row items-baseline justify-between">
        <Text className="text-[20px] leading-[26px] font-semibold">
          {run ? runLabel(run) : "Any time"}
        </Text>
        {run ? (
          <Text className="text-label text-ink-2">
            {run.to - run.from === 1 ? "1 hour" : `${run.to - run.from} hours`}
          </Text>
        ) : null}
      </View>
      <Text className="mt-1 mb-3 text-caption text-unit">Bars depict venues free each hour</Text>
      <HourTimeline counts={counts} run={run} earliest={earliest} onChange={setRun} />

      <View className="mt-7 flex-row gap-2.5">
        <View className="w-[104px]">
          <Button
            label="Clear"
            variant="secondary"
            size="small"
            onPress={() => setDraft({ date: null, start: null, hours: 1 })}
          />
        </View>
        <View className="flex-1">
          <Button
            label={
              count === null ? "Show venues" : `Show ${count} ${count === 1 ? "venue" : "venues"}`
            }
            size="small"
            onPress={() => onApply(draft)}
          />
        </View>
      </View>
    </Sheet>
  );
}
