import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isRTL } from "@/lib/language";

// Every screen: white, clear of the notch and home indicator, with the Figma screens' 20px gutters,
// and an optional footer for the buttons pinned to the bottom, which rises with the keyboard.
// The gutters sit on inner Views because SafeAreaView is native and sets its own side padding from
// the insets, which would overwrite them (and className doesn't reach it anyway).
//
// The direction is set here, on a plain View of its own, rather than through I18nManager: Expo Go
// resets I18nManager on every load, while Yoga's `direction` lays the screen out right-to-left
// everywhere. Builds are right-to-left natively too (expo-localization), and since `direction` is
// absolute the two agree rather than flipping twice.
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}
      >
        <View className="flex-1 px-5">{children}</View>
        {footer ? <View className="gap-2.5 px-5 pb-3 pt-3">{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
