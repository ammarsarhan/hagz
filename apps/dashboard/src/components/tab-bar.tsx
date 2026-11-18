import type { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { isRTL } from "@/lib/language";
import { IconBuildingStadium, IconCalendar, IconHome, IconUserCircle, IconWallet } from "./icons";
import { Text } from "./text";
import { VenueSwitcher } from "./venue-switcher";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// A venue's tabs (Figma "D3 · Venue tabs"): white, a hairline on top, five equal tabs over the home
// indicator. The open tab is staff blue with a heavier stroke and label; the rest are grey. Tabler
// has no filled wallet or stadium, so colour and weight mark it, the same for all five.
//
// A long press on the Venue tab opens the venue switcher (Figma "D3 · Venue switcher options",
// option C, with the stadium kept: the user preferred the icon to the venue's photo): a heavy tap,
// and the icon shrinks into a blue ring until the switcher closes.
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
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setSwitching(true);
            }}
            className="flex-1 items-center gap-[3px] pt-[7px]"
            style={{ height: ROW }}
          >
            <Held held={isVenue && switching}>
              <Icon
                size={24}
                color={focused ? colors.primary : colors.ink3}
                strokeWidth={focused ? 1.85 : 1.6}
              />
            </Held>
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

// Held (the switcher open), the Venue tab's icon springs down inside a blue ring with a little room
// around it, and back out when the switcher closes.
const HELD_SCALE = 17 / 24;
const SPRING = { damping: 16, stiffness: 260 };

function Held({ held, children }: { held: boolean; children: ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(held ? 1 : 0, SPRING);
  }, [held, progress]);
  const icon = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - HELD_SCALE) * progress.value }],
  }));
  const ring = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));

  return (
    <View className="size-6 items-center justify-center">
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 rounded-[8px] border-[1.75px] border-primary"
        style={ring}
      />
      <Animated.View style={icon}>{children}</Animated.View>
    </View>
  );
}
