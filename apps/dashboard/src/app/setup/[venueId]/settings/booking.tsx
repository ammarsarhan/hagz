import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/button";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { IconChevronRight } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SettingsRow } from "@/components/settings-row";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { Wheel, WheelBand, type WheelItem } from "@/components/wheel";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { hourLabel, shortDayName } from "@/lib/hours";
import { isRTL } from "@/lib/language";
import type { components } from "@hagz/api";

// Booking settings (Figma D18, 645:3), from Venue › Rules: holds, regulars and who counts as one,
// in the rows of the venue's other settings with each value at the row's end. A row opens a wheel
// sheet (645:176; two wheels side by side for "Becomes a regular", 645:333), whose Done stays grey
// until it differs from what's saved, and saves as it closes.
//
// Left out until what they do is built: the regulars' reminder, the discount on freed weeks and
// the empty-time alerts (the venue keeps their columns, nothing reads them yet).

type Settings = components["schemas"]["BookingSettings"];
type Change = Partial<Settings>;
type Opened = "hold" | "horizon" | "confirm" | "becomes" | "lapses";

// What each wheel offers: the steps people use, and whatever is saved now even if it's off them.
const HOLD_MINUTES = [5, 10, 15, 20, 30, 45, 60];
const HORIZON_WEEKS = range(1, 12);
const CONFIRM_HOURS = [2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120, 168];
const GAMES = range(1, 20);
const PERIOD_WEEKS = range(1, 26);
const LAPSED_WEEKS = range(1, 12);

// The week the timeline is drawn on: kick-off on a Sunday at 9 pm (Figma).
const KICK_OFF = { day: 0, hour: 21 };

export default function BookingSettings() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const { t } = useTranslation();
  const compact = useCompactTitle();
  const settings = useQuery(bookingSettingsQuery(venueId));
  // Changing them needs venue: manage (as the API asks); anyone else reads them.
  const { venue } = useCurrentVenue();
  const canEdit = venue?.permissions.venue === "manage";
  const title = t("screens.bookingSettings.title");

  return (
    <Screen>
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
          subtitle={t("screens.bookingSettings.subtitle")}
          onTitleLayout={compact.onTitleLayout}
        >
          {title}
        </Title>
        {settings.data ? (
          <SettingsList venueId={venueId} settings={settings.data} canEdit={canEdit} />
        ) : settings.isError ? (
          <Text className="mt-4 text-body text-ink-2">{t("screens.bookingSettings.failed")}</Text>
        ) : (
          <ActivityIndicator className="my-10" color={colors.ink3} />
        )}
      </FadingScroll>
    </Screen>
  );
}

function SettingsList({
  venueId,
  settings,
  canEdit,
}: {
  venueId: string;
  settings: Settings;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState<Opened | null>(null);
  // A fresh sheet each time, starting from what's saved.
  const [openings, setOpenings] = useState(0);
  const b = "screens.bookingSettings";

  const open = (sheet: Opened) =>
    canEdit
      ? () => {
          setOpenings((count) => count + 1);
          setOpened(sheet);
        }
      : undefined;
  const close = () => setOpened(null);

  const save = async (change: Change) => {
    close();
    const result = await send(
      api.PATCH("/v1/staff/venues/{venueId}/booking-settings", {
        params: { path: { venueId } },
        body: change,
      }),
    );
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    queryClient.setQueryData(bookingSettingsQuery(venueId).queryKey, result.data);
  };

  const words = {
    minutes: (count: number) => t(`${b}.minutes`, { count }),
    hours: (count: number) => t(`${b}.hours`, { count }),
    weeks: (count: number) => t(`${b}.weeks`, { count }),
    games: (count: number) => t(`${b}.gameCount`, { count }),
  };

  return (
    <>
      <GroupHeading className="mb-1">{t(`${b}.holds`)}</GroupHeading>
      <SettingsRow
        title={t(`${b}.holdFor`)}
        body={t(`${b}.holdForBody`)}
        trailing={<Value chevron={canEdit}>{words.minutes(settings.staffHoldMinutes)}</Value>}
        onPress={open("hold")}
      />

      <GroupHeading className="mb-1 mt-9">{t(`${b}.regulars`)}</GroupHeading>
      <Timeline t={t} hours={settings.confirmationWindow} />
      <SettingsRow
        title={t(`${b}.weeksAhead`)}
        trailing={<Value chevron={canEdit}>{words.weeks(settings.regularHorizon)}</Value>}
        onPress={open("horizon")}
      />
      <SettingsRow
        title={t(`${b}.confirmBy`)}
        body={t(`${b}.confirmByBody`)}
        trailing={
          <Value chevron={canEdit}>
            {t(`${b}.confirmByValue`, { hours: words.hours(settings.confirmationWindow) })}
          </Value>
        }
        onPress={open("confirm")}
      />

      <GroupHeading className="mb-1 mt-9">{t(`${b}.who`)}</GroupHeading>
      <View className="flex-row justify-between border-b border-border py-2.5">
        <Text className="text-caption text-ink-2">{t(`${b}.aCustomer`)}</Text>
        <Text className="text-caption text-ink-2">{t(`${b}.when`)}</Text>
      </View>
      <SettingsRow
        title={t(`${b}.becomes`)}
        trailing={
          <Value strong chevron={canEdit}>
            {t(`${b}.becomesValue`, {
              games: words.games(settings.regularBookings),
              weeks: words.weeks(settings.regularPeriod),
            })}
          </Value>
        }
        onPress={open("becomes")}
      />
      <SettingsRow
        title={t(`${b}.lapses`)}
        trailing={
          <Value strong chevron={canEdit}>
            {t(`${b}.lapsesValue`, { weeks: words.weeks(settings.lapsedAfter) })}
          </Value>
        }
        onPress={open("lapses")}
      />
      <Text className="mt-3 mb-6 text-caption text-ink-2">
        {canEdit ? `${t(`${b}.tapToChange`)} ` : ""}
        {t(`${b}.regularsFirst`)}
      </Text>

      <PickSheet
        key={`hold-${openings}`}
        visible={opened === "hold"}
        title={t(`${b}.holdFor`)}
        body={t(`${b}.holdForBody`)}
        wheels={[
          {
            label: t(`${b}.holdFor`),
            items: choices(HOLD_MINUTES, settings.staffHoldMinutes, words.minutes),
            value: settings.staffHoldMinutes,
          },
        ]}
        onClose={close}
        onDone={([staffHoldMinutes]) => void save({ staffHoldMinutes })}
      />
      <PickSheet
        key={`horizon-${openings}`}
        visible={opened === "horizon"}
        title={t(`${b}.weeksAhead`)}
        body={t(`${b}.weeksAheadBody`)}
        wheels={[
          {
            label: t(`${b}.weeksAhead`),
            items: choices(HORIZON_WEEKS, settings.regularHorizon, words.weeks),
            value: settings.regularHorizon,
          },
        ]}
        onClose={close}
        onDone={([regularHorizon]) => void save({ regularHorizon })}
      />
      <PickSheet
        key={`confirm-${openings}`}
        visible={opened === "confirm"}
        title={t(`${b}.confirmBySheet`)}
        body={t(`${b}.confirmBySheetBody`)}
        wheels={[
          {
            label: t(`${b}.confirmBySheet`),
            items: choices(CONFIRM_HOURS, settings.confirmationWindow, words.hours),
            value: settings.confirmationWindow,
          },
        ]}
        onClose={close}
        onDone={([confirmationWindow]) => void save({ confirmationWindow })}
      />
      <PickSheet
        key={`becomes-${openings}`}
        visible={opened === "becomes"}
        title={t(`${b}.becomes`)}
        body={t(`${b}.becomesBody`)}
        wheels={[
          {
            label: t(`${b}.games`),
            items: choices(GAMES, settings.regularBookings, words.games),
            value: settings.regularBookings,
          },
          {
            label: t(`${b}.weeksLabel`),
            items: choices(PERIOD_WEEKS, settings.regularPeriod, words.weeks),
            value: settings.regularPeriod,
          },
        ]}
        onClose={close}
        onDone={([regularBookings, regularPeriod]) => void save({ regularBookings, regularPeriod })}
      />
      <PickSheet
        key={`lapses-${openings}`}
        visible={opened === "lapses"}
        title={t(`${b}.lapses`)}
        body={t(`${b}.lapsesBody`)}
        wheels={[
          {
            label: t(`${b}.lapses`),
            items: choices(LAPSED_WEEKS, settings.lapsedAfter, words.weeks),
            value: settings.lapsedAfter,
          },
        ]}
        onClose={close}
        onDone={([lapsedAfter]) => void save({ lapsedAfter })}
      />
    </>
  );
}

// A row's value at its end, grey with a chevron; the "Who's a regular" rows' in ink, as a rule.
function Value({
  children,
  strong = false,
  chevron,
}: {
  children: string;
  strong?: boolean;
  chevron: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text
        className={`text-[15px] leading-[1.33] ${strong ? "font-semibold" : "text-ink-2"}`}
        numberOfLines={1}
      >
        {children}
      </Text>
      {chevron ? (
        <IconChevronRight
          size={18}
          color={colors.unit}
          strokeWidth={2}
          style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      ) : null}
    </View>
  );
}

// A regular's week from the deadline to kick-off (Figma, above the Regulars rows): a blue line
// between a hollow point (confirm by) and a filled one (kick-off), the gap named over it.
function Timeline({ t, hours }: { t: TFunction; hours: number }) {
  const b = "screens.bookingSettings";
  const at = (back: number) => {
    const total = (((KICK_OFF.day * 24 + KICK_OFF.hour - back) % 168) + 168) % 168;
    return t(`${b}.dayTime`, {
      day: shortDayName(t, Math.floor(total / 24)),
      time: hourLabel(t, total % 24),
    });
  };
  const gap = t(`${b}.hours`, { count: hours });
  const confirm = at(hours);
  const kickOff = at(0);
  return (
    <View
      accessible
      accessibilityLabel={t(`${b}.timeline`, { confirm, hours: gap, kickOff })}
      className="border-b border-border pt-2 pb-4"
    >
      <Text className="text-center text-caption font-medium text-primary">{gap}</Text>
      <View className="mt-1.5 flex-row items-center">
        <View className="size-[11px] rounded-full border-[1.5px] border-ink bg-white" />
        <View className="h-[1.5px] flex-1 bg-primary" />
        <View className="size-[11px] rounded-full bg-ink" />
      </View>
      <View className="mt-2 flex-row justify-between">
        <View>
          <Text className="text-label font-medium">{t(`${b}.confirmBy`)}</Text>
          <Text className="text-caption text-ink-2">{confirm}</Text>
        </View>
        <View className="items-end">
          <Text className="text-label font-medium">{t(`${b}.kickOff`)}</Text>
          <Text className="text-caption text-ink-2">{kickOff}</Text>
        </View>
      </View>
    </View>
  );
}

interface SheetWheel {
  label: string;
  items: WheelItem<number>[];
  value: number;
}

// A setting's wheel sheet (Figma 645:176 / 645:333): its title and line, one or two wheels on one
// band, and Done, grey until a wheel differs from what's saved.
function PickSheet({
  visible,
  title,
  body,
  wheels,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  body: string;
  wheels: SheetWheel[];
  onClose: () => void;
  onDone: (values: number[]) => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState(() => wheels.map((wheel) => wheel.value));
  const changed = values.some((value, i) => value !== wheels[i]?.value);
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {title}
      </Text>
      <Text className="mt-2 text-subtitle text-ink-2">{body}</Text>
      <View className="relative mt-5 flex-row">
        <WheelBand />
        {wheels.map((wheel, i) => (
          <Wheel
            key={wheel.label}
            label={wheel.label}
            items={wheel.items}
            value={wheel.value}
            onChange={(value) =>
              setValues((current) => current.map((old, at) => (at === i ? value : old)))
            }
          />
        ))}
      </View>
      <View className="mt-6">
        <Button
          label={t("screens.bookingSettings.done")}
          disabled={!changed}
          onPress={() => onDone(values)}
        />
      </View>
    </Sheet>
  );
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function choices(steps: number[], saved: number, label: (count: number) => string) {
  return [...new Set([...steps, saved])]
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: label(value) }));
}
