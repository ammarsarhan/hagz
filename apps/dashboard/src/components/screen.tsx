import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { useScreenHudAnchor } from "./hud";
import { useTabBarHeight } from "./tab-bar";
import { isRTL } from "@/lib/language";

// Every screen: white, clear of the notch and home indicator, with the Figma screens' 20px gutters,
// and an optional footer for the buttons pinned to the bottom. The footer sits on the home
// indicator, or on top of the keyboard when it's open (including one already open when the screen
// arrives). Dark status bar text on the white (onboarding sets light text on its blue, and comes
// back to it when popped). Tapping anywhere that isn't a field or button closes the keyboard. The gutters sit on inner Views because SafeAreaView is native and sets its own side
// padding from the insets, which would overwrite them (and className doesn't reach it anyway).
//
// The direction is set here, on a plain View of its own, rather than through I18nManager: Expo Go
// resets I18nManager on every load, while Yoga's `direction` lays the screen out right-to-left
// everywhere. Builds are right-to-left natively too (expo-localization), and since `direction` is
// absolute the two agree rather than flipping twice.
// The footer's top padding (pt-3).
const FOOTER_TOP = 12;

export function Screen({
  children,
  footer,
  tabbed = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  // One of a venue's tabs: the screen ends at the tab bar, which already clears the home indicator.
  tabbed?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const tabBar = useTabBarHeight();
  // How far the screen's own bottom edge sits above the phone's, and how much of the screen the
  // keyboard or home indicator covers from there (an open keyboard covers the tab bar too).
  const offset = tabbed ? tabBar : 0;
  const bottom = tabbed ? Math.max(keyboard - tabBar, 0) : keyboard > 0 ? keyboard : insets.bottom;

  // Where the HUD sits on, from the phone's bottom edge: the top of the pinned buttons (the footer
  // less its 12px top padding), or the keyboard, tab bar or home indicator when there are none. Only
  // the screen in view says.
  const [footerHeight, setFooterHeight] = useState(0);
  const lowestEdge =
    keyboard > 0 && !footer
      ? keyboard
      : offset + (footer ? Math.max(footerHeight - FOOTER_TOP, bottom) : bottom);
  const setHudAnchor = useScreenHudAnchor();
  useFocusEffect(useCallback(() => setHudAnchor(lowestEdge), [lowestEdge, setHudAnchor]));

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar style="dark" />
      <Pressable
        accessible={false}
        onPress={Keyboard.dismiss}
        style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}
      >
        <View className="flex-1 px-5">{children}</View>
        {footer ? (
          <View
            className="gap-2.5 px-5 pt-3"
            style={{ paddingBottom: bottom + 12 }}
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          >
            {footer}
          </View>
        ) : (
          <View style={{ height: tabbed ? 0 : insets.bottom }} />
        )}
      </Pressable>
    </SafeAreaView>
  );
}
