import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

// Two (or more) equal tabs in a grey track, the white thumb sliding under the picked one: Near me |
// Pick an area in Search's Where, Upcoming | Past on Bookings.
export function Segment<K extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  // Its margins where it sits.
  className?: string;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const at = useSharedValue(index);
  useEffect(() => {
    at.value = withTiming(index, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [index, at]);
  const half = (width - 8) / options.length;
  // The thumb sits at the start, which is the right in Arabic, so it moves the other way there.
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: at.value * half * (isRTL ? -1 : 1) }],
  }));
  return (
    <View
      className={`h-11 flex-row rounded-[14px] bg-chip p-1 ${className}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Animated.View
          className="absolute top-1 bottom-1 left-1 rounded-[11px] bg-white"
          style={[
            {
              width: half,
              shadowColor: "#0b0b0c",
              shadowOpacity: 0.08,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            className="flex-1 items-center justify-center"
          >
            <Text className={`text-body ${on ? "font-medium text-ink" : "text-ink-2"}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
