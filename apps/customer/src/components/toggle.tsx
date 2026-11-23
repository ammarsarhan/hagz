import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { isRTL } from "@/lib/language";

// The on/off switch from the Figma screens (Review's Need players?): a 51×31 track, grey off and
// black on, its white 27 thumb sliding across as the track's colour fades. Drawn here rather than
// RN's Switch so it's the same black on both platforms and always animates. The thumb runs from
// the end to the start in Arabic.
const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const THUMB = 27;
const INSET = 2;
const TRAVEL = TRACK_WIDTH - THUMB - INSET * 2;
const OFF = "#e9e9eb";
const ON = "#0b0b0c";

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value, progress]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [OFF, ON]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL * (isRTL ? -1 : 1) }],
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
    >
      <Animated.View
        style={[
          { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: 16, padding: INSET },
          track,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: 14,
              backgroundColor: "#ffffff",
              shadowColor: "#000000",
              shadowOpacity: 0.15,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
            thumb,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
