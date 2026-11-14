import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

// A screen's scrolling body that runs to the nav bar and the footer instead of stopping short of
// them. The gap under the nav bar is padding inside the scroll, so rows scroll right up to the close
// button, and each edge fades the content out (only while there's more past it) rather than cutting
// a row in half against white. Full width, so the fades span the gutters too.
//
// Pass `scrollY` to drive something else from the scroll (the setup checklist's compact title). It's
// tracked on the native side, so whatever it animates keeps pace with the finger.
const FADE = 28;
// The nav bar's spacing (NavBar's mb-[22px]), here as the scroll's top padding, less the 8px a
// flush NavBar pads under itself.
const NAV_GAP = 14;

export function FadingScroll({
  children,
  scrollY,
}: {
  children: ReactNode;
  scrollY?: Animated.Value;
}) {
  const own = useRef(new Animated.Value(0)).current;
  const offset = scrollY ?? own;
  const size = useRef({ height: 0, content: 0, y: 0 });
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = () => {
    const { height, content, y } = size.current;
    const top = y > 1;
    const bottom = y + height < content - 1;
    setEdges((now) => (now.top === top && now.bottom === bottom ? now : { top, bottom }));
  };

  return (
    <View className="-mx-5 flex-1">
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        // A form inside it: a tap on another field or a button works first time, keyboard up or not.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: NAV_GAP, paddingBottom: FADE }}
        onLayout={(event) => {
          size.current.height = event.nativeEvent.layout.height;
          measure();
        }}
        onContentSizeChange={(_, height) => {
          size.current.content = height;
          measure();
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], {
          useNativeDriver: true,
          listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
            size.current.y = event.nativeEvent.contentOffset.y;
            measure();
          },
        })}
      >
        {children}
      </Animated.ScrollView>
      <Fade edge="top" shown={edges.top} />
      <Fade edge="bottom" shown={edges.bottom} />
    </View>
  );
}

function Fade({ edge, shown }: { edge: "top" | "bottom"; shown: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: shown ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [shown, opacity]);

  const id = `fade-${edge}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, height: FADE, [edge]: 0, opacity }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient
            id={id}
            x1="0"
            y1={edge === "top" ? "0" : "1"}
            x2="0"
            y2={edge === "top" ? "1" : "0"}
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
