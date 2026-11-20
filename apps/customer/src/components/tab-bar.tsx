import type { Icon } from "@tabler/icons-react-native";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { IconHome, IconSearch, IconTicket, IconUserCircle, IconUsersGroup } from "./icons";
import { Text } from "./text";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// The customer's tabs (Figma "C3 · Tabs & Search", option A · Plain, 93:2; the user's pick on
// 2026-11-20): white, a hairline on top, five equal tabs over the home indicator. The open tab is
// black with a heavier stroke and a semibold label; the rest are grey. No lime here: it's kept for
// the big moments.
const ROW = 49;

// Each tab's strings live under components.tabs.<tab>. In Arabic the row runs right to left, Home
// on the right.
type Tab = "home" | "search" | "community" | "bookings" | "account";
const TABS: Record<Tab, Icon> = {
  home: IconHome,
  search: IconSearch,
  community: IconUsersGroup,
  bookings: IconTicket,
  account: IconUserCircle,
};
const isTab = (name: string): name is Tab => name in TABS;

export function TabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View
      className="flex-row border-t border-hairline bg-white"
      style={{ paddingBottom: insets.bottom, direction: isRTL ? "rtl" : "ltr" }}
    >
      {state.routes.map((route, index) => {
        if (!isTab(route.name)) return null;
        const label = t(`components.tabs.${route.name}`);
        const focused = state.index === index;
        const Glyph = TABS[route.name];
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
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
