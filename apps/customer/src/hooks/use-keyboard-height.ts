import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from "react-native";

// How much of the screen the keyboard covers. Unlike KeyboardAvoidingView, it starts from the
// keyboard that's already open, so a screen pushed while typing lays out right from its first frame
// instead of jumping when the next keyboard event arrives. Changes animate with the keyboard's own
// timing.
//
// Where the keyboard is heading is tracked once for the whole app, from launch. Keyboard.isVisible()
// only turns false on keyboardDidHide, after the slide down, so a screen pushed straight after
// Keyboard.dismiss() (sign-in → blocked) read the closing keyboard as open; and the hide event had
// already gone by before the screen's own listener subscribed, so its footer stayed stuck halfway up.
// The tracker hears the event whoever is mounted, and each screen re-reads it once subscribed.

// iOS reports before the keyboard moves (so the layout moves with it); Android only after.
const [SHOW, HIDE] =
  Platform.OS === "ios"
    ? (["keyboardWillShow", "keyboardWillHide"] as const)
    : (["keyboardDidShow", "keyboardDidHide"] as const);

let target = Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0;
Keyboard.addListener(SHOW, (event) => {
  target = event.endCoordinates.height;
});
Keyboard.addListener(HIDE, () => {
  target = 0;
});

export function useKeyboardHeight() {
  const [height, setHeight] = useState(() => target);

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
    const subscriptions = [
      Keyboard.addListener(SHOW, update(1)),
      Keyboard.addListener(HIDE, update(0)),
    ];
    // Anything that happened between the first render and now.
    setHeight(target);
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return height;
}
