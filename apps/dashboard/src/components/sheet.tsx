import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRTL } from "@/lib/language";
import { SheetHud } from "./hud";
import { CloseButton } from "./nav";

// A bottom sheet: dimmed screen behind, white panel with 28px top corners, a grab handle, and only
// the close button (end side) above the content. Tapping outside closes it. The Modal renders
// outside the screen, so it sets the direction itself, and it rises with the keyboard.
//
// To close, set `visible` to false and keep it mounted: it slides down, then calls `onHidden` once
// it's really gone (on iOS, when the Modal says it's dismissed), which is when to unmount it or to
// present something else. Unmounting straight away skips the slide.
const DURATION = 220;
// A `scrollable` sheet stops growing at this share of the screen.
const MAX_SHARE = 0.75;

interface SheetProps {
  visible: boolean;
  // Asks to close (the close button, the backdrop, Android's back button).
  onClose: () => void;
  // Called once it has slid away.
  onHidden?: () => void;
  closeLabel: string;
  // A title centred on the close button's row (the photo sheet's "Photo #2"), instead of a row of
  // its own under it.
  header?: ReactNode;
  // A long list (the venue switcher): the panel stops at 75% of the screen and what's under the
  // close row scrolls, only when it's more than fits. Shorter, it neither scrolls nor bounces.
  scrollable?: boolean;
  children: ReactNode;
}

export function Sheet({
  visible,
  onClose,
  onHidden,
  closeLabel,
  header,
  scrollable = false,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  // Whether the content is taller than the room it's given.
  const [room, setRoom] = useState(0);
  const [content, setContent] = useState(0);
  const overflows = content > room + 1;
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
              ...(scrollable && { maxHeight: screen * MAX_SHARE }),
              transform: [
                // Down by the whole screen, so even a tall panel slides all the way out.
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [screen, 0],
                  }),
                },
              ],
            }}
          >
            {/* Tapping the panel outside a field or button closes the keyboard. */}
            <Pressable
              accessible={false}
              onPress={Keyboard.dismiss}
              style={scrollable ? { flexShrink: 1 } : undefined}
            >
              <View className="mb-3.5 h-[5px] w-9 self-center rounded-full bg-grab" />
              {/* A scrollable sheet keeps room under this row, so the list scrolls away beneath a gap
                  rather than straight under the title. */}
              <View
                className={`h-10 flex-row items-center justify-end ${scrollable ? "mb-4" : ""}`}
              >
                {header ? (
                  <View pointerEvents="none" className="absolute inset-x-12 items-center">
                    {header}
                  </View>
                ) : null}
                <CloseButton label={closeLabel} onPress={onClose} />
              </View>
              {scrollable ? (
                <ScrollView
                  style={{ flexShrink: 1 }}
                  scrollEnabled={overflows}
                  bounces={overflows}
                  showsVerticalScrollIndicator={overflows}
                  onLayout={(event) => setRoom(event.nativeEvent.layout.height)}
                  onContentSizeChange={(_, height) => setContent(height)}
                >
                  {children}
                </ScrollView>
              ) : (
                children
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
        <SheetHud open={visible && panelTop !== null} bottom={area - (panelTop ?? 0)} />
      </View>
    </Modal>
  );
}
