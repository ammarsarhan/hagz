import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
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
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const bottom = keyboard > 0 ? keyboard : insets.bottom;

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
          <View className="gap-2.5 px-5 pt-3" style={{ paddingBottom: bottom + 12 }}>
            {footer}
          </View>
        ) : (
          <View style={{ height: insets.bottom }} />
        )}
      </Pressable>
    </SafeAreaView>
  );
}
