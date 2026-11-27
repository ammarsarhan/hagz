import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Text } from "./text";

// A screen's big title, carried up beside its back or close button once it has scrolled away (first
// on the setup checklist), so the screen still says what it is. It fades in over the last stretch of
// the big title going under the nav bar, rising as it does, and follows the finger both ways: it's
// driven by FadingScroll's scroll position on the native side.
//
//   const compact = useCompactTitle();
//   <NavBar flush start={<CompactTitle button={…} title="Details" style={compact.style} />} />
//   <FadingScroll scrollY={compact.scrollY}>
//     <Title onTitleLayout={compact.onTitleLayout}>Details</Title>
const FADE = 24;
const RISE = 6;

export function useCompactTitle() {
  const scrollY = useRef(new Animated.Value(0)).current;
  // Where the big title ends in the scroll; the compact one is fully in once it's gone under.
  const [titleEnd, setTitleEnd] = useState(0);
  const range = [Math.max(titleEnd - FADE, 0), Math.max(titleEnd, 1)];
  const style = {
    opacity: scrollY.interpolate({ inputRange: range, outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: range,
          outputRange: [RISE, 0],
          extrapolate: "clamp",
        }),
      },
    ],
  };
  const onTitleLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setTitleEnd(y + height);
  };
  return { scrollY, style, onTitleLayout };
}

export function CompactTitle({
  button,
  title,
  detail,
  style,
}: {
  // The round back or close button it sits beside.
  button: ReactNode;
  title: string;
  // A second, grey line ("1/6 items done").
  detail?: string;
  style: ReturnType<typeof useCompactTitle>["style"];
}) {
  const { width } = useWindowDimensions();
  return (
    <View className="flex-row items-center gap-3">
      {button}
      <Animated.View
        pointerEvents="none"
        // Screen readers get the big title.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // The gutters, the button and the gap: a long title ends in "…", not off-screen.
        style={[style, { maxWidth: width - 40 - 40 - 12 }]}
      >
        <Text className="text-body font-semibold leading-[1.25]" numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text className="text-caption text-ink-2" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

// A tab's pinned bar that names the section scrolled to (the Venue tab): small and empty at first,
// then
// each section's heading once it has gone under ("Details", "People", "Rules"), and back again
// scrolling up. A new name rolls in the way the page is moving. A grey hairline under the bar
// once anything has scrolled under it.
//
//   const sections = useSectionTitle();
//   <PinnedTitle sections={sections}>
//     <FadingScroll scrollY={sections.scrollY} topLine={false}>
//       <View onLayout={sections.onLayout("Details")}><SettingsHeading>Details</SettingsHeading></View>
//     </FadingScroll>
//   </PinnedTitle>
const ROLL_MS = 180;
// The bar's height empty (with the scroll's own top padding, about the gap a tab's title had),
// and with a name in it.
const BAR_SMALL = 6;
const BAR_FULL = 44;

export function useSectionTitle() {
  const scrollY = useRef(new Animated.Value(0)).current;
  // Where each heading ends in the scroll; a heading is current once the scroll is past it.
  const ends = useRef(new Map<string, number>());
  const [current, setCurrent] = useState<{ label: string | null; down: boolean }>({
    label: null,
    down: true,
  });
  const [scrolled, setScrolled] = useState(false);
  const shown = useRef<{ label: string | null; index: number; scrolled: boolean }>({
    label: null,
    index: -1,
    scrolled: false,
  });

  const pick = useCallback((y: number) => {
    const under = y > 0;
    if (under !== shown.current.scrolled) {
      shown.current.scrolled = under;
      setScrolled(under);
    }
    const passed = [...ends.current.entries()]
      .sort((a, b) => a[1] - b[1])
      .filter(([, end]) => y >= end);
    const index = passed.length - 1;
    const label = passed.at(-1)?.[0] ?? null;
    if (label === shown.current.label) return;
    const down = index > shown.current.index;
    shown.current = { ...shown.current, label, index };
    setCurrent({ label, down });
  }, []);

  useEffect(() => {
    // Native-driven, so the scroll keeps its pace; JS only hears it to swap the words.
    const id = scrollY.addListener(({ value }) => pick(value));
    return () => scrollY.removeListener(id);
  }, [scrollY, pick]);

  const onLayout = (label: string) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    ends.current.set(label, y + height);
  };

  return { scrollY, current, scrolled, onLayout };
}

export function PinnedTitle({
  sections,
  children,
}: {
  sections: ReturnType<typeof useSectionTitle>;
  // The page's scroll, which runs under the bar.
  children: ReactNode;
}) {
  const { label, down } = sections.current;
  // Small while it has nothing to say, full height with a name; it floats over the scroll, so
  // growing doesn't move the page.
  const height = useSharedValue(BAR_SMALL);
  useEffect(() => {
    height.value = withTiming(label === null ? BAR_SMALL : BAR_FULL, {
      duration: ROLL_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [label, height]);
  const grow = useAnimatedStyle(() => ({ height: height.value }));
  return (
    <View className="flex-1">
      <View style={{ height: BAR_SMALL }} />
      <View className="flex-1">{children}</View>
      <Reanimated.View
        // Full width, so the hairline runs edge to edge.
        className={`absolute top-0 justify-center overflow-hidden border-b bg-white px-5 ${sections.scrolled ? "border-border" : "border-transparent"}`}
        style={[{ left: -20, right: -20 }, grow]}
        // Screen readers get the headings themselves.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <View className="h-5 overflow-hidden">
          {label === null ? null : (
            <Reanimated.View
              key={label}
              entering={(down ? FadeInUp : FadeInDown).duration(ROLL_MS)}
              exiting={(down ? FadeOutUp : FadeOutDown).duration(ROLL_MS)}
              className="absolute inset-x-0 top-0"
            >
              <Text className="text-body font-semibold leading-[20px]" numberOfLines={1}>
                {label}
              </Text>
            </Reanimated.View>
          )}
        </View>
      </Reanimated.View>
    </View>
  );
}
