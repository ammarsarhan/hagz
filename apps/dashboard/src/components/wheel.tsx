import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Text } from "./text";

// An iOS-style wheel (Figma "Pick a number (wheel sheet)", 451:2): the choices scroll past a grey
// band, snapping to one at a time, the chosen one larger and the rest fading away from it. Drawn
// here rather than with the native picker, which would need a new native build. It reports each
// choice as it passes the band (with a tick), so what it changes updates while it turns.
//
// Mount it with the value it starts on (a `key` per opening): it doesn't follow `value` afterwards.
const ROW = 40;
const VISIBLE = 5;

export interface WheelItem<T> {
  value: T;
  label: string;
}

export function Wheel<T>({
  items,
  value,
  onChange,
  label,
}: {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const start = Math.max(
    items.findIndex((item) => item.value === value),
    0,
  );
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(start * ROW);
  const index = useRef(start);

  const settle = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), items.length - 1);
    if (clamped === index.current) return;
    index.current = clamped;
    void Haptics.selectionAsync();
    const item = items[clamped];
    if (item) onChange(item.value);
  };

  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.y;
  });
  useAnimatedReaction(
    () => Math.round(offset.value / ROW),
    (now, before) => {
      if (now !== before) runOnJS(settle)(now);
    },
  );

  const go = (to: number) => ref.current?.scrollTo({ y: to * ROW, animated: true });

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index.current]?.label }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) =>
        go(index.current + (nativeEvent.actionName === "increment" ? 1 : -1))
      }
      style={{ height: ROW * VISIBLE }}
      className="flex-1"
    >
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: start * ROW }}
        contentContainerStyle={{ paddingVertical: ROW * Math.floor(VISIBLE / 2) }}
      >
        {items.map((item, i) => (
          <Row key={String(item.value)} index={i} offset={offset} onPress={() => go(i)}>
            {item.label}
          </Row>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

// One choice: full size and ink on the band, smaller and fainter the further it is from it.
function Row({
  index,
  offset,
  onPress,
  children,
}: {
  index: number;
  offset: SharedValue<number>;
  onPress: () => void;
  children: string;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value / ROW - index);
    return {
      opacity: interpolate(distance, [0, 1, 2], [1, 0.55, 0.25], "clamp"),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.88], "clamp") }],
    };
  });
  return (
    <Pressable onPress={onPress} style={{ height: ROW }} className="items-center justify-center">
      <Animated.View style={style}>
        <Text className="text-[20px] font-medium">{children}</Text>
      </Animated.View>
    </Pressable>
  );
}

// The band the chosen row sits on, drawn once behind the wheels of a sheet (one or several).
export function WheelBand() {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 rounded-[10px] bg-chip"
      style={{ top: ROW * Math.floor(VISIBLE / 2), height: ROW }}
    />
  );
}
