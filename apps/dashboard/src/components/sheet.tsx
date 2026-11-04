import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Keyboard, KeyboardAvoidingView, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRTL } from "@/lib/language";
import { SheetHud } from "./hud";
import { CloseButton } from "./nav";

// A bottom sheet: dimmed screen behind, white panel with 28px top corners, a grab handle, and only
// the close button (end side) above the content. Tapping outside closes it. The Modal renders
// outside the screen, so it sets the direction itself, and it rises with the keyboard.
//
// To close, set `visible` to false and keep it mounted: it slides down, then calls `onHidden`, which
// is when to unmount it. Unmounting straight away skips the slide.
const DURATION = 220;

interface SheetProps {
  visible: boolean;
  // Asks to close (the close button, the backdrop, Android's back button).
  onClose: () => void;
  // Called once it has slid away.
  onHidden?: () => void;
  closeLabel: string;
  children: ReactNode;
}

export function Sheet({ visible, onClose, onHidden, closeLabel, children }: SheetProps) {
  const insets = useSafeAreaInsets();
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
      hidden.current?.();
    });
  }, [visible, progress]);

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1">
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1 justify-end"
          onLayout={(event) => setArea(event.nativeEvent.layout.height)}
        >
          <Animated.View className="absolute inset-0 bg-scrim" style={{ opacity: progress }}>
            <Pressable accessibilityLabel={closeLabel} onPress={onClose} className="flex-1" />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            onLayout={(event) => setPanelTop(event.nativeEvent.layout.y)}
            className="rounded-t-sheet bg-white px-6 pt-2.5"
            style={{
              paddingBottom: insets.bottom + 12,
              direction: isRTL ? "rtl" : "ltr",
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) },
              ],
            }}
          >
            {/* Tapping the panel outside a field or button closes the keyboard. */}
            <Pressable accessible={false} onPress={Keyboard.dismiss}>
              <View className="mb-3.5 h-[5px] w-9 self-center rounded-full bg-grab" />
              <View className="flex-row justify-end">
                <CloseButton label={closeLabel} onPress={onClose} />
              </View>
              {children}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
        <SheetHud open={visible && panelTop !== null} bottom={area - (panelTop ?? 0)} />
      </View>
    </Modal>
  );
}
