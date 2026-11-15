import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
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
// here rather than with the native picker, which would need a new native build.
//
// It ticks as each choice passes the band, but reports a choice only once it comes to rest, so the
// screen behind isn't redrawn on every row of a fling. It starts on the value it's mounted with and
// then leads itself: give it a `key` per opening rather than steering it with `value`.
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
  // Where it starts, worked out once: a starting offset that changed with each choice would make
  // iOS jump the wheel mid-spin.
  const [start] = useState(() =>
    Math.max(
      items.findIndex((item) => item.value === value),
      0,
    ),
  );
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(start * ROW);
  // The choice last reported, and the latest callback and items (a turn can outlive a render).
  const reported = useRef(start);
  const latest = useRef({ items, onChange });
  latest.current = { items, onChange };
  const [, redraw] = useState(0);

  const clamp = (i: number) => Math.min(Math.max(i, 0), latest.current.items.length - 1);
  const tick = () => void Haptics.selectionAsync();
  const report = (i: number) => {
    const index = clamp(i);
    if (index === reported.current) return;
    reported.current = index;
    redraw((n) => n + 1);
    const item = latest.current.items[index];
    if (item) latest.current.onChange(item.value);
  };

  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.y;
  });
  // A tick for every row that crosses the band, as the native wheel does.
  useAnimatedReaction(
    () => Math.round(offset.value / ROW),
    (now, before) => {
      if (before !== null && now !== before) runOnJS(tick)();
    },
  );

  const rest = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    report(Math.round(event.nativeEvent.contentOffset.y / ROW));
  const go = (i: number) => {
    const index = clamp(i);
    ref.current?.scrollTo({ y: index * ROW, animated: true });
    report(index);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[reported.current]?.label }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) =>
        go(reported.current + (nativeEvent.actionName === "increment" ? 1 : -1))
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
        // Android has no contentOffset: put it in place once it's laid out.
        onLayout={() => ref.current?.scrollTo({ y: start * ROW, animated: false })}
        // At rest after a fling (and its snap), or let go without one.
        onMomentumScrollEnd={rest}
        onScrollEndDrag={(event) => {
          const velocity = event.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(velocity) < 0.05) rest(event);
        }}
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
