import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { IconAlertCircleFilled } from "./icons";
import { Text } from "./text";

// Problems that aren't the person's fault (WhatsApp down, offline, a session that expired): a
// short line in a light pill floating above the bottom buttons, where they're looking after
// tapping. It never covers navigation and goes away by itself. Keep messages short ("Couldn't send
// the code"); field problems belong under the field instead.
const VISIBLE_MS = 3000;
// Clear of two stacked 56px buttons and their gaps, as in the Figma screens.
const ABOVE_BUTTONS = 144;

const HudContext = createContext<{ show: (message: string) => void } | null>(null);

export const useHud = () => {
  const hud = useContext(HudContext);
  if (!hud) throw new Error("useHud needs HudProvider");
  return hud;
};

export function HudProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const show = useCallback((next: string) => {
    setMessage(next);
    setShownAt(Date.now());
  }, []);

  // Stable, so screens can list the HUD in their effects' dependencies.
  const value = useMemo(() => ({ show }), [show]);

  return (
    <HudContext.Provider value={value}>
      {children}
      {message ? <Hud key={shownAt} message={message} onHidden={() => setMessage(null)} /> : null}
    </HudContext.Provider>
  );
}

function Hud({ message, onHidden }: { message: string; onHidden: () => void }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(VISIBLE_MS),
      Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => finished && onHidden());
    return () => animation.stop();
  }, [progress, onHidden]);

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center"
      style={{ bottom: insets.bottom + ABOVE_BUTTONS, direction: isRTL ? "rtl" : "ltr" }}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="h-14 flex-row items-center gap-2.5 rounded-hud border border-hairline bg-hud pe-[22px] ps-[18px]"
        style={{
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
          shadowColor: "#0b0b0c",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <IconAlertCircleFilled size={22} color={colors.ink} />
        <Text className="text-subtitle font-medium">{message}</Text>
      </Animated.View>
    </View>
  );
}
