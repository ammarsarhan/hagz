import type { Icon } from "@tabler/icons-react-native";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { IconHome, IconSearch, IconTicket, IconUserCircle, IconUsersGroup } from "./icons";
import { Text } from "./text";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// The customer's tabs (Figma "C3 · Tabs & Search", option A · Plain, 93:2; the user's pick on
// 2026-11-20): white, a hairline on top, five equal tabs over the home indicator. The open tab is
// black with a heavier stroke and a semibold label; the rest are grey. No lime here: it's kept for
// the big moments.
const ROW = 49;

const TABS: Record<string, { icon: Icon; label: string }> = {
  home: { icon: IconHome, label: "Home" },
  search: { icon: IconSearch, label: "Search" },
  community: { icon: IconUsersGroup, label: "Community" },
  bookings: { icon: IconTicket, label: "Bookings" },
  account: { icon: IconUserCircle, label: "Account" },
};

export function TabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row border-t border-hairline bg-white"
      style={{ paddingBottom: insets.bottom }}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const Glyph = tab.icon;
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
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={press}
            className="flex-1 items-center gap-[3px] pt-[7px]"
            style={{ height: ROW }}
          >
            <Glyph
              size={24}
              color={focused ? colors.ink : colors.ink3}
              strokeWidth={focused ? 2 : 1.6}
            />
            <Text
              className={`text-[11px] leading-[13px] ${focused ? "font-semibold text-ink" : "font-medium text-ink-3"}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
