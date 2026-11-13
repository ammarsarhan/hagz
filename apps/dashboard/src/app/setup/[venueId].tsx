import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { IconChevronRight } from "@/components/icons";
import { CloseButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import type { components } from "@hagz/api";
import { hudMessage } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { queries } from "@/lib/queries";

// A draft venue's setup checklist (Figma "Venue creation · 7 Setup checklist (draft flow)", 285:2):
// everything left to do before it can be sent for review, in any order, each item saved as it's
// done. The server works the list out from the venue itself on every read, so this screen never
// decides what's finished — it only draws it.
//
// It's a page of its own, not the venue tabs: a draft has no bookings, calendar or money to run
// (docs/flows.md, "draft venues"), so the tabs would be dead ends around a checklist.
type SetupItem = components["schemas"]["SetupItem"];

// The ring around the count of required items done.
const RING = 60;
const RING_WIDTH = 4;

export default function VenueSetupScreen() {
  const { t } = useTranslation();
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const hud = useHud();
  const setup = useQuery(queries.setup(venueId));

  const failed = setup.isError;
  useEffect(() => {
    if (failed) hud.show(hudMessage(setup.error));
  }, [failed, setup.error, hud]);

  // Closing leaves the setup flow for where it started: first run, which now shows the draft card.
  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));

  if (!setup.data) {
    return (
      <Screen
        footer={
          failed ? (
            <Button label={t("screens.firstRun.retry")} onPress={() => void setup.refetch()} />
          ) : undefined
        }
      >
        <NavBar start={<CloseButton label={t("components.shared.nav.close")} onPress={close} />} />
        {failed ? null : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.ink3} />
          </View>
        )}
      </Screen>
    );
  }

  const { venue, items, required, canSubmit } = setup.data;
  const left = required.total - required.done;
  // What to do next: the first required item that can actually be done now.
  const next = items.find((item) => item.required && item.state === "MISSING");

  return (
    <Screen
      footer={
        <>
          <Text className="text-center text-caption text-ink-2">
            {canSubmit
              ? t("screens.setup.readyToSend")
              : t("screens.setup.itemsLeft", { count: left })}
          </Text>
          <Button
            label={t("screens.setup.send")}
            variant={canSubmit ? "primary" : "secondary"}
            disabled={!canSubmit}
            onPress={() => hud.show(t("common.comingNext"))}
          />
        </>
      }
    >
      <NavBar start={<CloseButton label={t("components.shared.nav.close")} onPress={close} />} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title subtitle={t("screens.setup.subtitle")}>
          {venue.name ?? t("screens.setup.untitled")}
        </Title>

        <View className="mb-2 flex-row items-center gap-4 pt-1">
          <ProgressRing done={required.done} total={required.total} />
          <View className="flex-1">
            <Text className="text-subtitle font-medium leading-[1.31]">
              {t("screens.setup.progress", { done: required.done, total: required.total })}
            </Text>
            <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
              {next
                ? t("screens.setup.nextUp", { item: t(`screens.setup.items.${next.key}.title`) })
                : t("screens.setup.allDone")}
            </Text>
          </View>
        </View>

        <Group heading={t("screens.setup.required")} items={items.filter((i) => i.required)} />
        <Group heading={t("screens.setup.optional")} items={items.filter((i) => !i.required)} />
        <View className="h-4" />
      </ScrollView>
    </Screen>
  );
}

function Group({ heading, items }: { heading: string; items: SetupItem[] }) {
  const { t } = useTranslation();
  const hud = useHud();
  if (items.length === 0) return null;
  return (
    <>
      <Text
        accessibilityRole="header"
        className="mb-1 mt-7 text-[22px] font-semibold leading-[1.27]"
      >
        {heading}
      </Text>
      {items.map((item, index) => (
        <Item
          key={item.key}
          item={item}
          last={index === items.length - 1}
          // Each item's own screen arrives with its slice of Phase 2; until then the row says so
          // rather than opening something half-built.
          onPress={() => hud.show(t("common.comingNext"))}
        />
      ))}
    </>
  );
}

// One line of the checklist. A blocked item (opening hours before there's a ground) is greyed and
// can't be opened: tapping it would only show a screen with nothing to fill in.
function Item({ item, last, onPress }: { item: SetupItem; last: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const blocked = item.state === "BLOCKED";
  const done = item.state === "DONE";
  // Needs doing: ink and medium. Done, optional or waiting: grey and quiet. No reds or greens
  // anywhere in the staff app — emphasis is weight and colour of ink (Figma 285:2).
  const status = blocked
    ? {
        dot: "bg-ink-3",
        text: "text-ink-3 font-medium",
        label: t("screens.setup.states.waiting"),
      }
    : done
      ? { dot: "bg-ink-3", text: "text-ink-2", label: t("screens.setup.states.done") }
      : item.required
        ? { dot: "bg-ink", text: "text-ink font-medium", label: t("screens.setup.states.todo") }
        : { dot: "bg-ink-3", text: "text-ink-3 font-medium", label: t("screens.setup.states.optional") }; // prettier-ignore

  return (
    <Pressable
      accessibilityRole={blocked ? undefined : "button"}
      disabled={blocked}
      onPress={onPress}
      className={`flex-row items-center gap-3 py-4 active:opacity-60 ${last ? "" : "border-b border-border"}`}
    >
      <View className="flex-1">
        <Text className={`text-subtitle font-medium leading-[1.31] ${blocked ? "text-ink-3" : ""}`}>
          {t(`screens.setup.items.${item.key}.title`)}
        </Text>
        <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
          {blocked
            ? t("screens.setup.states.blockedBody")
            : t(`screens.setup.items.${item.key}.body`)}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <View className={`size-[7px] rounded-full ${status.dot}`} />
          <Text className={`text-caption ${status.text}`}>{status.label}</Text>
        </View>
      </View>
      {blocked ? null : (
        <IconChevronRight
          size={18}
          color={colors.ink3}
          style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      )}
    </Pressable>
  );
}

// How far through the required items they are, as a ring that fills clockwise with the count
// inside it. Drawn rather than animated: it changes between screens, not while you watch it.
function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = (RING - RING_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = total > 0 ? (done / total) * circumference : 0;
  return (
    <View style={{ width: RING, height: RING }} className="items-center justify-center">
      <Svg width={RING} height={RING} style={{ position: "absolute" }}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={RING_WIDTH}
          fill="none"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={RING_WIDTH}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${filled} ${circumference}`}
          // From the top, not from three o'clock.
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text className="text-subtitle font-semibold">{`${done}/${total}`}</Text>
    </View>
  );
}
