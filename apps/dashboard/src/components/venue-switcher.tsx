import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { colors } from "@/lib/colors";
import { switchVenue } from "@/lib/current-venue";
import { unfinishedVenue } from "@/lib/venues";
import { useHud } from "./hud";
import { IconCheck, IconPlus } from "./icons";
import { Sheet } from "./sheet";
import { Text } from "./text";
import { VenueCover } from "./venue-cover";

type StaffVenue = components["schemas"]["StaffVenue"];

// The venue switcher (Figma "D3 · Venue switcher options", option C), opened by a long press on the
// Venue tab: every venue they run, with its cover, area and their role, the open one ticked; a
// paused one says so. Picking another swaps the tab's cover and says where they are now. At the
// foot, the way to a new venue: their draft if they have one (the API allows one), else creating
// one. Drafts never appear as venues here: they have nothing to run (docs/flows.md, "draft venues").
export function VenueSwitcher({
  visible,
  onClose,
  venues,
  running,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  // Everything they belong to, for the draft.
  venues: StaffVenue[];
  // The ones listed.
  running: StaffVenue[];
  current: StaffVenue;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const draft = unfinishedVenue(venues);
  // What to do once the sheet has slid away: say where they are, or open the setup flow. Either
  // waits, so the HUD isn't drawn inside the closing sheet and nothing is pushed under its Modal.
  const after = useRef<(() => void) | null>(null);

  const pick = (venue: StaffVenue) => {
    if (venue.id !== current.id) {
      // At once, so the tab's cover has changed by the time the sheet is gone.
      switchVenue(venue.id);
      void Haptics.selectionAsync();
      after.current = () =>
        hud.show(
          t("components.venueSwitcher.switched", {
            name: venue.name ?? t("components.venueSwitcher.untitled"),
          }),
          { leading: <VenueCover venue={venue} size={28} radius={8} /> },
        );
    }
    onClose();
  };

  const startOrContinue = () => {
    after.current = () =>
      draft
        ? router.push({ pathname: "/setup/[venueId]", params: { venueId: draft.id } })
        : router.push("/create-venue");
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => {
        after.current?.();
        after.current = null;
      }}
      closeLabel={t("components.venueSwitcher.close")}
    >
      {running.map((venue) => (
        <VenueRow
          key={venue.id}
          venue={venue}
          selected={venue.id === current.id}
          onPress={() => pick(venue)}
        />
      ))}
      <View className="my-1.5 h-px bg-hairline" />
      <Pressable
        accessibilityRole="button"
        onPress={startOrContinue}
        className="flex-row items-center gap-3.5 py-2.5"
      >
        <View className="size-[52px] items-center justify-center rounded-[14px] bg-chip">
          <IconPlus size={22} color={colors.ink} strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text className="text-subtitle font-medium">
            {draft
              ? t("components.venueSwitcher.continueSetup")
              : t("components.venueSwitcher.createVenue")}
          </Text>
          {draft ? (
            <Text className="text-label text-ink-2" numberOfLines={1}>
              {draft.name ?? t("components.venueSwitcher.untitled")}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Sheet>
  );
}

function VenueRow({
  venue,
  selected,
  onPress,
}: {
  venue: StaffVenue;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const role =
    venue.role === "OWNER"
      ? t("components.venueSwitcher.owner")
      : t("components.venueSwitcher.member");
  const line = [venue.location, role].filter(Boolean).join(" · ");

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityHint={selected ? t("components.venueSwitcher.current") : undefined}
      onPress={onPress}
      className="flex-row items-center gap-3.5 py-2.5"
    >
      <VenueCover venue={venue} size={52} radius={14} />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={`shrink text-subtitle ${selected ? "font-semibold" : "font-medium"}`}
            numberOfLines={1}
          >
            {venue.name ?? t("components.venueSwitcher.untitled")}
          </Text>
          {venue.status === "MAINTENANCE" ? (
            <View className="rounded-full bg-chip px-2 py-0.5">
              <Text className="text-caption font-medium text-ink-2">
                {t("components.venueSwitcher.paused")}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-label text-ink-2" numberOfLines={1}>
          {line}
        </Text>
      </View>
      {selected ? (
        <View className="size-6 items-center justify-center rounded-full bg-primary">
          <IconCheck size={15} color={colors.white} strokeWidth={2.6} />
        </View>
      ) : (
        <View className="size-6 rounded-full border-[1.5px] border-ink-3" />
      )}
    </Pressable>
  );
}
