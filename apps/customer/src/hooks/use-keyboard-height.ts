import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from "react-native";

// How much of the screen the keyboard covers. Unlike KeyboardAvoidingView, it starts from the
// keyboard that's already open (Keyboard.metrics), so a screen pushed while typing lays out right
// from its first frame instead of jumping when the next keyboard event arrives. Changes animate with
// the keyboard's own timing.
export function useKeyboardHeight() {
  const [height, setHeight] = useState(() =>
    Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );

  useEffect(() => {
    const update = (next: number) => (event: KeyboardEvent) => {
      if (event.duration > 0) {
        LayoutAnimation.configureNext({
          duration: event.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(next === 0 ? 0 : event.endCoordinates.height);
    };
    // iOS reports before the keyboard moves (so the layout moves with it); Android only after.
    const [show, hide] =
      Platform.OS === "ios"
        ? (["keyboardWillShow", "keyboardWillHide"] as const)
        : (["keyboardDidShow", "keyboardDidHide"] as const);
    const subscriptions = [
      Keyboard.addListener(show, update(1)),
      Keyboard.addListener(hide, update(0)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return height;
}
