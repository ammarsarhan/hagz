import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Reanimated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from "react-native-reanimated";
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

// A tab's pinned title that follows the page (the Venue tab): empty while the big title shows, the
// page's name once it has gone under (faded in like CompactTitle), then each section's heading as
// it goes under in turn ("Details", "People", "Rules"), and back again scrolling up. A new name
// rolls in the way the page is moving.
//
//   const compact = useCompactTitle();
//   const sections = useSectionTitle(compact.scrollY);
//   <PinnedTitle title="Venue" sections={sections} style={compact.style} />
//   <FadingScroll scrollY={compact.scrollY}>
//     <Title onTitleLayout={compact.onTitleLayout}>Venue</Title>
//     <View onLayout={sections.onLayout("Details")}><SettingsHeading>Details</SettingsHeading></View>
const ROLL_MS = 180;

export function useSectionTitle(scrollY: Animated.Value) {
  // Where each heading ends in the scroll; a heading is current once the scroll is past it.
  const ends = useRef(new Map<string, number>());
  const [current, setCurrent] = useState<{ label: string | null; down: boolean }>({
    label: null,
    down: true,
  });
  const shown = useRef<{ label: string | null; index: number }>({ label: null, index: -1 });

  const pick = useCallback((y: number) => {
    const passed = [...ends.current.entries()]
      .sort((a, b) => a[1] - b[1])
      .filter(([, end]) => y >= end);
    const index = passed.length - 1;
    const label = passed.at(-1)?.[0] ?? null;
    if (label === shown.current.label) return;
    const down = index > shown.current.index;
    shown.current = { label, index };
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

  return { current, onLayout };
}

export function PinnedTitle({
  title,
  sections,
  style,
}: {
  title: string;
  sections: ReturnType<typeof useSectionTitle>;
  style: ReturnType<typeof useCompactTitle>["style"];
}) {
  const { label, down } = sections.current;
  const words = label ?? title;
  return (
    <View
      className="h-11 justify-center"
      // Screen readers get the big title and the headings themselves.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View pointerEvents="none" style={style}>
        <View className="h-5 overflow-hidden">
          <Reanimated.View
            key={words}
            entering={(down ? FadeInUp : FadeInDown).duration(ROLL_MS)}
            exiting={(down ? FadeOutUp : FadeOutDown).duration(ROLL_MS)}
            className="absolute inset-x-0 top-0"
          >
            <Text className="text-body font-semibold leading-[20px]" numberOfLines={1}>
              {words}
            </Text>
          </Reanimated.View>
        </View>
      </Animated.View>
    </View>
  );
}
