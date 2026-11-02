import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRTL } from "@/lib/language";
import { CloseButton } from "./nav";

// A bottom sheet: dimmed screen behind, white panel with 28px top corners, a grab handle, and only
// the close button (end side) above the content. Tapping outside closes it. The Modal renders
// outside the screen, so it sets the direction itself, and it rises with the keyboard.
const DURATION = 220;

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}

export function Sheet({ visible, onClose, closeLabel, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  // Stay mounted while sliding out.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => finished && !visible && setMounted(false));
  }, [visible, progress]);

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
        <Animated.View className="absolute inset-0 bg-scrim" style={{ opacity: progress }}>
          <Pressable accessibilityLabel={closeLabel} onPress={onClose} className="flex-1" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          className="rounded-t-sheet bg-white px-6 pt-2.5"
          style={{
            paddingBottom: insets.bottom + 12,
            direction: isRTL ? "rtl" : "ltr",
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) },
            ],
          }}
        >
          <View className="mb-3.5 h-[5px] w-9 self-center rounded-full bg-grab" />
          <View className="flex-row justify-end">
            <CloseButton label={closeLabel} onPress={onClose} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
