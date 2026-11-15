import { useRef, useState, type ReactNode } from "react";
import { Pressable } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors } from "@/lib/colors";
import { IconTrash } from "./icons";

// A list row that swipes left to show Delete, like an iOS list (the grounds, custom cancellation
// rules). The row spans the screen so Delete opens at its very edge; put the list in `-mx-5` and the
// lines between rows outside them (see the grounds list), so they stay put as a row slides.
//
// `useSwipeRows` keeps one row open at a time: opening another closes it, and tapping any row while
// one is open just closes that one.
export function useSwipeRows() {
  const open = useRef<SwipeableMethods | null>(null);
  return {
    opened: (row: SwipeableMethods | null) => {
      if (open.current && open.current !== row) open.current.close();
      open.current = row;
    },
    // True when a tap only closed an open row.
    closeOpen: () => {
      if (!open.current) return false;
      open.current.close();
      open.current = null;
      return true;
    },
    forget: () => {
      open.current = null;
    },
  };
}

export function SwipeRow({
  label,
  deleteLabel,
  onPress,
  onOpen,
  onDelete,
  disabled = false,
  canDelete = true,
  children,
}: {
  // What a screen reader says for the row.
  label: string;
  deleteLabel: string;
  onPress?: () => void;
  onOpen: (row: SwipeableMethods | null) => void;
  // Gets the row, to close it if the delete is called off (null from VoiceOver's action).
  onDelete: (row: SwipeableMethods | null) => void;
  // Not tappable (still swipeable unless canDelete is off).
  disabled?: boolean;
  canDelete?: boolean;
  children: ReactNode;
}) {
  const swipe = useRef<SwipeableMethods>(null);
  const [pressed, setPressed] = useState(false);
  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={canDelete}
      // Follows the finger one to one, as iOS's rows do, and stops at the button's width.
      friction={1}
      rightThreshold={40}
      overshootRight={false}
      // The row is solid white, so the button behind it only shows as the row slides away.
      childrenContainerStyle={{ backgroundColor: colors.white }}
      onSwipeableWillOpen={() => onOpen(swipe.current)}
      // The platform's red, with a bin: the one place the staff app uses red outside errors, because
      // a swipe action that isn't red doesn't read as iOS's Delete.
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={() => onDelete(swipe.current)}
          className="w-20 items-center justify-center bg-red"
        >
          <IconTrash size={24} color={colors.white} strokeWidth={1.75} />
        </Pressable>
      )}
    >
      <Pressable
        accessibilityRole={disabled ? undefined : "button"}
        accessibilityLabel={label}
        // VoiceOver can't swipe a row open, so Delete is one of its actions instead.
        accessibilityActions={canDelete ? [{ name: "delete", label: deleteLabel }] : undefined}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === "delete") onDelete(null);
        }}
        disabled={disabled}
        onPress={onPress}
        // Pressed shows as a grey highlight, never as fading: a see-through row would show the red
        // button behind it. Classes from state rather than a style function, which NativeWind drops
        // next to className. The short delay keeps a swipe from lighting the row up at all.
        unstable_pressDelay={90}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        className={`flex-row items-center gap-3 px-5 py-[15px] ${pressed ? "bg-chip" : "bg-white"}`}
      >
        {children}
      </Pressable>
    </ReanimatedSwipeable>
  );
}
