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
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { IconAlertCircleFilled } from "./icons";
import { Text } from "./text";

// Problems that aren't the person's fault (WhatsApp down, offline, a session that expired): a
// short line in a light pill just above the lowest thing on screen, where they're looking after
// tapping. It never covers navigation and goes away by itself. Keep messages short ("Couldn't send
// the code"); field problems belong under the field instead.
//
// Where "just above" is comes from what's showing: the screen in view reports the top of its pinned
// buttons (or of the keyboard or home indicator when it has none), and an open sheet, which is a
// Modal drawn over everything, shows the HUD itself, above its panel.
const VISIBLE_MS = 3000;
// Between the HUD and what it sits on.
const GAP = 16;

const HudContext = createContext<{ show: (message: string) => void } | null>(null);

// Who reports where the HUD goes: the focused screen its lowest edge (a distance from the bottom of
// the screen), and sheets that they're open (the last on top). Stable, so reporting doesn't make
// every screen re-render each time a HUD shows.
interface Anchors {
  setScreenAnchor: (bottom: number) => void;
  openSheet: (id: number) => void;
  closeSheet: (id: number) => void;
}

// What's showing, and the sheet that draws it (null: the app's root does).
interface Showing {
  current: { message: string; key: number; onHidden: () => void } | null;
  topSheet: number | null;
}

const AnchorsContext = createContext<Anchors | null>(null);
const ShowingContext = createContext<Showing>({ current: null, topSheet: null });

export const useHud = () => {
  const hud = useContext(HudContext);
  if (!hud) throw new Error("useHud needs HudProvider");
  return hud;
};

const useAnchors = () => {
  const anchors = useContext(AnchorsContext);
  if (!anchors) throw new Error("The HUD's placement needs HudProvider");
  return anchors;
};

// For Screen: report this screen's lowest edge while it's the one in view.
export const useScreenHudAnchor = () => useAnchors().setScreenAnchor;

// For Sheet: while open, the HUD shows inside it, above its panel (`bottom` from the screen's bottom).
let sheets = 0;
export function SheetHud({ open, bottom }: { open: boolean; bottom: number }) {
  const { openSheet, closeSheet } = useAnchors();
  const { current, topSheet } = useContext(ShowingContext);
  const id = useRef(++sheets).current;

  useEffect(() => {
    if (!open) return;
    openSheet(id);
    return () => closeSheet(id);
  }, [open, id, openSheet, closeSheet]);

  if (!current || topSheet !== id) return null;
  return (
    <Hud
      key={current.key}
      message={current.message}
      bottom={bottom + GAP}
      onHidden={current.onHidden}
    />
  );
}

export function HudProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const [screenBottom, setScreenBottom] = useState(0);
  const [open, setOpen] = useState<number[]>([]);

  const show = useCallback((next: string) => {
    setMessage(next);
    setShownAt(Date.now());
  }, []);
  const onHidden = useCallback(() => setMessage(null), []);

  // Stable, so screens can list the HUD in their effects' dependencies.
  const value = useMemo(() => ({ show }), [show]);
  const anchors = useMemo<Anchors>(
    () => ({
      setScreenAnchor: setScreenBottom,
      openSheet: (id) => setOpen((list) => [...list.filter((sheet) => sheet !== id), id]),
      closeSheet: (id) => setOpen((list) => list.filter((sheet) => sheet !== id)),
    }),
    [],
  );
  const topSheet = open.at(-1) ?? null;
  const showing = useMemo<Showing>(
    () => ({ current: message ? { message, key: shownAt, onHidden } : null, topSheet }),
    [message, shownAt, onHidden, topSheet],
  );
  const { current } = showing;

  return (
    <HudContext.Provider value={value}>
      <AnchorsContext.Provider value={anchors}>
        <ShowingContext.Provider value={showing}>
          {children}
          {current && topSheet === null ? (
            <Hud
              key={current.key}
              message={current.message}
              bottom={screenBottom + GAP}
              onHidden={onHidden}
            />
          ) : null}
        </ShowingContext.Provider>
      </AnchorsContext.Provider>
    </HudContext.Provider>
  );
}

function Hud({
  message,
  bottom,
  onHidden,
}: {
  message: string;
  bottom: number;
  onHidden: () => void;
}) {
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
      style={{ bottom, direction: isRTL ? "rtl" : "ltr" }}
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
