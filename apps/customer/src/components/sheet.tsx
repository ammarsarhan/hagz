import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SheetHud } from "./hud";
import { CloseButton } from "./nav";

// A bottom sheet: dimmed screen behind, white panel with 28px top corners, a grab handle, and only
// the close button (end side) above the content. Tapping outside closes it, and it rises with the
// keyboard.
//
// To close, set `visible` to false and keep it mounted: it slides down, then calls `onHidden` once
// it's really gone (on iOS, when the Modal says it's dismissed), which is when to unmount it or to
// present something else. Unmounting straight away skips the slide.
const DURATION = 220;

interface SheetProps {
  visible: boolean;
  // Asks to close (the close button, the backdrop, Android's back button).
  onClose: () => void;
  // Called once it has slid away.
  onHidden?: () => void;
  // A title centred on the close button's row (the photo sheet's "Photo #2"), instead of a row of
  // its own under it.
  header?: ReactNode;
  // A sheet that scrolls and has no fields: its content isn't wrapped in the tap that closes the
  // keyboard, which would take the touch before the scroll view could start scrolling.
  scrolls?: boolean;
  children: ReactNode;
}

export function Sheet({
  visible,
  onClose,
  onHidden,
  header,
  scrolls = false,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const Wrapper = scrolls ? View : Pressable;
  const progress = useRef(new Animated.Value(0)).current;
  // Stay mounted while sliding out.
  const [mounted, setMounted] = useState(visible);
  const hidden = useRef(onHidden);
  hidden.current = onHidden;
  // The HUD shows inside the sheet (a Modal covers the app's own), just above the panel: measured
  // where the panel's top lands, so it's right whether the keyboard pads the view (iOS) or shrinks
  // the window (Android).
  const [area, setArea] = useState(0);
  const [panelTop, setPanelTop] = useState<number | null>(null);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || visible) return;
      setMounted(false);
      // On iOS the Modal is still on screen until it reports it's gone (onDismiss below), and
      // anything presented before then (the photo picker) is silently refused.
      if (Platform.OS !== "ios") hidden.current?.();
    });
  }, [visible, progress]);

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      onDismiss={Platform.OS === "ios" ? () => hidden.current?.() : undefined}
      statusBarTranslucent
    >
      {/* A Modal is its own window: gestures in it (sliders, the scroll view) need a root of their
          own, one for the whole sheet so they all share touches. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1 justify-end"
          onLayout={(event) => setArea(event.nativeEvent.layout.height)}
        >
          <Animated.View className="absolute inset-0 bg-scrim" style={{ opacity: progress }}>
            <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1" />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            onLayout={(event) => setPanelTop(event.nativeEvent.layout.y)}
            className="rounded-t-sheet bg-white px-6 pt-2.5"
            style={{
              paddingBottom: insets.bottom + 12,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) },
              ],
            }}
          >
            {/* Tapping the panel outside a field or button closes the keyboard. */}
            <Wrapper accessible={false} onPress={Keyboard.dismiss}>
              <View className="mb-3.5 h-[5px] w-9 self-center rounded-full bg-grab" />
              <View className="h-10 flex-row items-center justify-end">
                {header ? (
                  <View pointerEvents="none" className="absolute inset-x-12 items-center">
                    {header}
                  </View>
                ) : null}
                <CloseButton onPress={onClose} />
              </View>
              {children}
            </Wrapper>
          </Animated.View>
        </KeyboardAvoidingView>
        <SheetHud open={visible && panelTop !== null} bottom={area - (panelTop ?? 0)} />
      </GestureHandlerRootView>
    </Modal>
  );
}
