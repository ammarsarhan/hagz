import { useRef, useState, type ReactNode } from "react";
import { Animated, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
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
