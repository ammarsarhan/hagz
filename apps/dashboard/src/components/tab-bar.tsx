import type { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { isRTL } from "@/lib/language";
import { IconBuildingStadium, IconCalendar, IconHome, IconUserCircle, IconWallet } from "./icons";
import { Text } from "./text";
import { VenueCover } from "./venue-cover";
import { VenueSwitcher } from "./venue-switcher";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// A venue's tabs (Figma "D3 · Venue tabs"): white, a hairline on top, five equal tabs over the home
// indicator. The open tab is staff blue with a heavier stroke and label; the rest are grey. Tabler
// has no filled wallet or stadium, so colour and weight mark it, the same for all five.
//
// The Venue tab is the venue (Figma "D3 · Venue switcher options", option C): its cover in place of
// the stadium, ringed blue while open, so which venue you're on is always in view. A long press on
// it opens the switcher.
const ROW = 49;
const HAIRLINE = 1;

const TABS = {
  index: { icon: IconHome, label: "home" },
  calendar: { icon: IconCalendar, label: "calendar" },
  manage: { icon: IconBuildingStadium, label: "venue" },
  payments: { icon: IconWallet, label: "payments" },
  account: { icon: IconUserCircle, label: "account" },
} as const;

// How much of the screen the bar takes, from the bottom edge (Screen measures above it).
export const useTabBarHeight = () => ROW + HAIRLINE + useSafeAreaInsets().bottom;

export function TabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { venue, venues, running } = useCurrentVenue();
  const [switching, setSwitching] = useState(false);

  return (
    <View
      className="flex-row border-t border-hairline bg-white"
      style={{ paddingBottom: insets.bottom, direction: isRTL ? "rtl" : "ltr" }}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name as keyof typeof TABS];
        if (!tab) return null;
        const focused = state.index === index;
        const Icon = tab.icon;
        const label = t(`components.tabs.${tab.label}`);
        const isVenue = route.name === "manage";

        const press = () => {
          const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={press}
            onLongPress={() => {
              emitter.emit({ type: "tabLongPress", target: route.key });
              if (!isVenue || !venue) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSwitching(true);
            }}
            className="flex-1 items-center gap-[3px] pt-[7px]"
            style={{ height: ROW }}
          >
            {isVenue && venue?.coverPreview ? (
              // 24 pt like the icons: a 20 pt cover in a ring that turns blue while the tab is open.
              <View
                className={`size-6 items-center justify-center rounded-[8px] border-[1.75px] ${focused ? "border-primary" : "border-transparent"}`}
              >
                <VenueCover venue={venue} size={17} radius={5} />
              </View>
            ) : (
              <Icon
                size={24}
                color={focused ? colors.primary : colors.ink3}
                strokeWidth={focused ? 1.85 : 1.6}
              />
            )}
            <Text
              className={`text-[11px] leading-[13px] ${focused ? "font-semibold text-primary" : "font-medium text-ink-3"}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
      {venue && venues.data ? (
        <VenueSwitcher
          visible={switching}
          onClose={() => setSwitching(false)}
          venues={venues.data}
          running={running}
          current={venue}
        />
      ) : null}
    </View>
  );
}
