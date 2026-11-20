import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { hourLabel, localDate, type SearchParams, type When, useVenueCount } from "@/lib/search";
import { Button } from "./button";
import { Sheet } from "./sheet";
import { Text } from "./text";

// When to play (Figma "C3 · Tabs & Search", option 5, 100:2): a sheet over Search with the next two
// weeks as day tiles, any time or a start hour, and how long. The button says how many venues the
// choice finds before it's applied; Clear goes back to today, any time, an hour.

const DAYS = 14;
const LENGTHS = [1, 2, 3];
// The earliest start offered on a day that isn't today.
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
  const day = at.getUTCDate();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-[72px] w-[58px] items-center justify-center gap-0.5 rounded-[14px] ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      <Text className={`text-caption ${on ? "text-white" : "text-ink-2"}`}>{weekday}</Text>
      <Text className={`text-[20px] leading-6 font-medium ${on ? "text-white" : "text-ink"}`}>
        {day}
      </Text>
    </Pressable>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-10 basis-[23%] items-center justify-center rounded-full ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      <Text className={`text-body font-medium ${on ? "text-white" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

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
  // The search as it stands without its when, for counting what a choice would find.
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
  // Today offers only the hours still ahead.
  const nowHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
  const firstHour = date === today ? Math.min(23, nowHour + 1) : FIRST_HOUR;
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => firstHour + i);

  const count = useVenueCount(
    {
      ...params,
      ...(draft.date ? { date: draft.date } : {}),
      ...(draft.start ? { start: draft.start } : {}),
      hours: draft.hours,
    },
    visible,
  );

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
              setDraft((previous) => ({
                ...previous,
                date: day === today ? null : day,
                // A start that's passed on the new day goes back to any time.
                start:
                  day === today && previous.start && Number(previous.start.slice(0, 2)) <= nowHour
                    ? null
                    : previous.start,
              }))
            }
          />
        ))}
      </ScrollView>

      <Text className="mt-6 mb-2.5 text-label font-medium text-ink-2">Start</Text>
      <View className="flex-row flex-wrap gap-2">
        <Pill
          label="Any time"
          on={draft.start === null}
          onPress={() => setDraft((previous) => ({ ...previous, start: null }))}
        />
        {hours.map((hour) => {
          const start = `${String(hour).padStart(2, "0")}:00`;
          return (
            <Pill
              key={hour}
              label={hourLabel(hour)}
              on={draft.start === start}
              onPress={() => setDraft((previous) => ({ ...previous, start }))}
            />
          );
        })}
      </View>

      <Text className="mt-6 mb-2.5 text-label font-medium text-ink-2">How long</Text>
      <View className="flex-row rounded-xl bg-chip p-[3px]">
        {LENGTHS.map((length) => {
          const on = draft.hours === length;
          return (
            <Pressable
              key={length}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setDraft((previous) => ({ ...previous, hours: length }))}
              className={`h-[38px] flex-1 items-center justify-center rounded-[10px] ${on ? "bg-white" : ""}`}
              style={
                on
                  ? {
                      shadowColor: "#000",
                      shadowOpacity: 0.12,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 1 },
                    }
                  : undefined
              }
            >
              <Text className={`text-body font-medium ${on ? "text-ink" : "text-ink-2"}`}>
                {length === 1 ? "1 hour" : `${length} hours`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-7 flex-row gap-2.5">
        <View className="w-[112px]">
          <Button
            label="Clear"
            variant="secondary"
            onPress={() => setDraft({ date: null, start: null, hours: 1 })}
          />
        </View>
        <View className="flex-1">
          <Button
            label={
              count === null ? "Show venues" : `Show ${count} ${count === 1 ? "venue" : "venues"}`
            }
            onPress={() => onApply(draft)}
          />
        </View>
      </View>
    </Sheet>
  );
}
