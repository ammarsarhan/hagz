import { useNavigation } from "expo-router";
import type { NativeStackNavigationProp } from "expo-router/native-stack";
import { useEffect, type RefObject } from "react";

// Focuses an input once the screen has finished sliding in, rather than on mount: focusing during
// the push raises the keyboard while the screen is still moving, and the two motions fight. Where
// no transition comes (a sheet opening, the first screen) it focuses after a short delay instead.
const FALLBACK_MS = 450;

export function useFocusAfterTransition(
  input: RefObject<{ focus: () => void } | null>,
  enabled: boolean,
) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();

  useEffect(() => {
    if (!enabled) return;
    let done = false;
    const focus = () => {
      if (done) return;
      done = true;
      input.current?.focus();
    };
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (!event.data.closing) focus();
    });
    const fallback = setTimeout(focus, FALLBACK_MS);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [enabled, input, navigation]);
}
