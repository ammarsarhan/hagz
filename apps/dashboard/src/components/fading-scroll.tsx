import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Animated, ScrollView, View } from "react-native";
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

// For something inside that scrolls the page itself (the hours grid, while a drag reaches the
// edge): moves the scroll by up to `dy`, kept within the content, and says how far it went; and
// where the visible part sits in the window.
export interface ScrollController {
  scrollBy: (dy: number) => number;
  visible: () => { top: number; bottom: number };
}

export function FadingScroll({
  children,
  scrollY,
  scrollEnabled = true,
  topFade = FADE,
  controller,
}: {
  children: ReactNode;
  scrollY?: Animated.Value;
  // Off while something inside is being dragged (photos into order), so the drag doesn't scroll.
  scrollEnabled?: boolean;
  // A shorter top fade for content that's mostly pictures, where a full one washes out too much.
  topFade?: number;
  controller?: RefObject<ScrollController | null>;
}) {
  const own = useRef(new Animated.Value(0)).current;
  const offset = scrollY ?? own;
  const size = useRef({ height: 0, content: 0, y: 0 });
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const frame = useRef<ComponentRef<typeof View>>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const windowTop = useRef(0);

  useEffect(() => {
    if (!controller) return;
    controller.current = {
      scrollBy: (dy) => {
        const { height, content, y } = size.current;
        const next = Math.min(Math.max(y + dy, 0), Math.max(content - height, 0));
        if (next === y) return 0;
        scroll.current?.scrollTo({ y: next, animated: false });
        size.current.y = next;
        return next - y;
      },
      visible: () => ({
        top: windowTop.current,
        bottom: windowTop.current + size.current.height,
      }),
    };
    return () => {
      controller.current = null;
    };
  }, [controller]);

  const measure = () => {
    const { height, content, y } = size.current;
    const top = y > 1;
    const bottom = y + height < content - 1;
    setEdges((now) => (now.top === top && now.bottom === bottom ? now : { top, bottom }));
  };

  return (
    <View ref={frame} className="-mx-5 flex-1">
      <Animated.ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        // A form inside it: a tap on another field or a button works first time, keyboard up or not.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: NAV_GAP, paddingBottom: FADE }}
        onLayout={(event) => {
          size.current.height = event.nativeEvent.layout.height;
          measure();
          frame.current?.measureInWindow((_, y) => {
            windowTop.current = y;
          });
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
      <Fade edge="top" shown={edges.top} height={topFade} />
      <Fade edge="bottom" shown={edges.bottom} height={FADE} />
    </View>
  );
}

function Fade({ edge, shown, height }: { edge: "top" | "bottom"; shown: boolean; height: number }) {
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
      style={{ position: "absolute", left: 0, right: 0, height, [edge]: 0, opacity }}
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
