import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Content that opens and closes by growing to its own height and fading in, instead of popping in
// (the price fields under the amenity sheet's switch). It stays mounted while closed, so it's
// measured up front and closing slides it away rather than cutting it off. The content is laid out
// on its own, unclipped, and the outer view animates to that height. A sheet anchored to the bottom
// grows upward with it.
const EASE = { duration: 240, easing: Easing.out(Easing.cubic) };

export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, EASE);
  }, [open, progress]);
  const style = useAnimatedStyle(() => ({
    height: height * progress.value,
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={[{ overflow: "hidden" }, style]}
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    >
      <View
        style={{ position: "absolute", top: 0, start: 0, end: 0 }}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}
