import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

// Picking one of a few options (Figma "Grounds · Add", 352:2 and 353:2). Choosing one eases its
// outline and tint in and the last one's out, rather than snapping.
const FADE = { duration: 180, easing: Easing.out(Easing.quad) };
const SLIDE = { duration: 240, easing: Easing.out(Easing.cubic) };

// 0 when off, 1 when chosen, eased between.
export function useSelection(selected: boolean) {
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, FADE);
  }, [progress, selected]);
  return progress;
}

// The option's outline and fill, drawn behind its content: grey on white when off, blue on a blue
// tint when chosen. Behind rather than on the pressable, so the pressable keeps its classes for
// layout and the animated view takes styles only.
export function SelectionBox({
  progress,
  radius,
}: {
  progress: SharedValue<number>;
  radius: number;
}) {
  const style = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.white, colors.blueTint]),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderWidth: 1, borderRadius: radius }, style]}
    />
  );
}

// Two versions of the same content, one fading into the other: a label or icon changing colour.
// The "on" one sits over the "off" one, so the content keeps its size.
export function CrossFade({
  progress,
  off,
  on,
}: {
  progress: SharedValue<number>;
  off: ReactNode;
  on: ReactNode;
}) {
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const onStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <View>
      <Animated.View style={offStyle}>{off}</Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, onStyle]}>
        {on}
      </Animated.View>
    </View>
  );
}

// The round mark at the end of a one-of-several row (Figma "How players pay", 318:2, and
// "Cancellation · 1 Pick a policy", 330:2): a grey ring when off; chosen, the ring turns blue and a
// blue dot grows in it. Decorative: the row it sits in is the radio for screen readers.
const MARK = 22;
const DOT = 12;

export function RadioMark({ selected }: { selected: boolean }) {
  const progress = useSelection(selected);
  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [colors.ink3, colors.primary]),
  }));
  const dot = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.4 + 0.6 * progress.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width: MARK,
          height: MARK,
          borderRadius: MARK / 2,
          borderWidth: 1.5,
          alignItems: "center",
          justifyContent: "center",
        },
        ring,
      ]}
    >
      <Animated.View
        style={[
          { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.primary },
          dot,
        ]}
      />
    </Animated.View>
  );
}

// A rounded pill, 44 high (36 when small, for a short row that must stay on one line). Pills
// wrap, so they suit lists whose labels vary in length (sizes, surfaces).
export function ChoicePill({
  label,
  selected,
  onPress,
  small = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  const progress = useSelection(selected);
  const size = small ? "text-label" : "text-body";
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`justify-center active:opacity-70 ${small ? "h-9 px-3.5" : "h-11 px-[18px]"}`}
    >
      <SelectionBox progress={progress} radius={small ? 18 : 22} />
      <CrossFade
        progress={progress}
        off={<Text className={`${size} font-medium`}>{label}</Text>}
        on={<Text className={`${size} font-medium text-primary`}>{label}</Text>}
      />
    </Pressable>
  );
}

export function ChoicePills({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return (
    <View
      accessibilityRole="radiogroup"
      className={`flex-row flex-wrap ${small ? "gap-2" : "gap-2.5"}`}
    >
      {children}
    </View>
  );
}

// Three or so short options sharing one grey track, the chosen one on a raised white thumb that
// slides to it. For a choice whose options are a scale (outdoor, covered, indoor) rather than a
// list.
const PAD = 3;

export function Segmented<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const segment = (width - PAD * 2) / options.length;
  const index = Math.max(options.indexOf(value), 0);
  const offset = useSharedValue(index);
  useEffect(() => {
    offset.value = withTiming(index, SLIDE);
  }, [index, offset]);
  const thumb = useAnimatedStyle(() => ({
    // `start` follows the reading direction, so the thumb moves the other way in Arabic.
    transform: [{ translateX: offset.value * segment * (isRTL ? -1 : 1) }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="flex-row rounded-[12px] bg-chip p-[3px]"
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: PAD,
              bottom: PAD,
              start: PAD,
              width: segment,
              borderRadius: 10,
              backgroundColor: colors.white,
            },
            RAISED,
            thumb,
          ]}
        />
      ) : null}
      {options.map((option) => (
        <Segment
          key={option}
          label={label(option)}
          selected={option === value}
          onPress={() => onChange(option)}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const progress = useSelection(selected);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className="h-[38px] flex-1 items-center justify-center"
    >
      <CrossFade
        progress={progress}
        off={<Text className="text-body font-medium text-ink-2">{label}</Text>}
        on={<Text className="text-body font-medium">{label}</Text>}
      />
    </Pressable>
  );
}

// Figma's 0 1 3 rgba(11,11,12,0.12).
const RAISED = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.12,
  shadowRadius: 1.5,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;
