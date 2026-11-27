import type { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Easing, runOnJS, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { allows, RULES } from "@/lib/access";
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
// option C, with the stadium kept: the user preferred the icon to the venue's photo) with a heavy
// tap, and the venue recedes behind it (see the venue layout).
const ROW = 49;
const HAIRLINE = 1;
// The icons' line weight, the customer app's: a little heavier on the tab in view.
const STROKE = { on: 1.7, off: 1.36 } as const;

const TABS = {
  index: { icon: IconHome, label: "home" },
  calendar: { icon: IconCalendar, label: "calendar" },
  manage: { icon: IconBuildingStadium, label: "venue" },
  payments: { icon: IconWallet, label: "payments" },
  account: { icon: IconUserCircle, label: "account" },
} as const;

const TAB_RULES = { calendar: RULES.calendar, payments: RULES.payments } as const;

// How much of the screen the bar takes, from the bottom edge (Screen measures above it).
export const useTabBarHeight = () => ROW + HAIRLINE + useSafeAreaInsets().bottom;

// The venue recedes in step with the switcher's sheet: eased out on the way back, settling as the
// sheet lands, and straight back on close.
const RECEDE = { duration: 320, easing: Easing.out(Easing.cubic) };
const RETURN = { duration: 260, easing: Easing.out(Easing.cubic) };

export function TabBar({
  state,
  emitter,
  navigateToTab,
  depth,
  onRecede,
}: TabBarProps & {
  // The venue layout's recede (0 at rest, 1 behind the switcher), and when it's away from rest.
  depth: SharedValue<number>;
  onRecede: (receded: boolean) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { venue, venues, running } = useCurrentVenue();
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (switching) onRecede(true);
    depth.value = withTiming(switching ? 1 : 0, switching ? RECEDE : RETURN, (finished) => {
      if (finished && !switching) runOnJS(onRecede)(false);
    });
  }, [switching, depth, onRecede]);

  return (
    <View
      className="flex-row border-t border-hairline bg-white"
      style={{ paddingBottom: insets.bottom, direction: isRTL ? "rtl" : "ltr" }}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name as keyof typeof TABS];
        if (!tab) return null;
        // A tab whose screen wouldn't open isn't offered (Calendar, Payments).
        const rule = TAB_RULES[route.name as keyof typeof TAB_RULES];
        if (rule && !allows(venue?.permissions, rule)) return null;
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
            <Icon
              size={24}
              color={focused ? colors.primary : colors.ink3}
              strokeWidth={focused ? STROKE.on : STROKE.off}
            />
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
