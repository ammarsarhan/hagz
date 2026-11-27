import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Animated, ScrollView, View } from "react-native";

// A screen's scrolling body that runs to the nav bar and the footer instead of stopping short of
// them. The gap under the nav bar is padding inside the scroll, so rows scroll right up to the close
// button. Each edge shows a hairline while there's more past it, the customer app's way (user,
// 2026-11-27, in place of fades that washed buttons into gradients): the top one fades in over the
// first 12 pt scrolled. Full width, so the lines span the gutters too.
//
// Pass `scrollY` to drive something else from the scroll (the setup checklist's compact title). It's
// tracked on the native side, so whatever it animates keeps pace with the finger.
// The room left under the last row.
const ROOM = 28;
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
  topLine = true,
  controller,
}: {
  children: ReactNode;
  scrollY?: Animated.Value;
  // Off while something inside is being dragged (photos into order), so the drag doesn't scroll.
  scrollEnabled?: boolean;
  // Off where the screen draws its own line under the bar (Manage's docked section tabs).
  topLine?: boolean;
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: NAV_GAP, paddingBottom: ROOM }}
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
      {topLine ? <TopHairline scrollY={offset} /> : null}
      <BottomLine shown={edges.bottom} />
    </View>
  );
}

// The line under the bar once anything has scrolled beneath it, fading in over the first 12 pt.
// Exported for screens that scroll a list of their own (Customers), inside a full-width View.
export function TopHairline({ scrollY }: { scrollY: Animated.Value }) {
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute top-0 right-0 left-0 h-px bg-hairline"
      style={{
        opacity: scrollY.interpolate({
          inputRange: [0, 12],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
      }}
    />
  );
}

// The bottom edge's hairline, while there's more below.
function BottomLine({ shown }: { shown: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: shown ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [shown, opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute right-0 bottom-0 left-0 h-px bg-hairline"
      style={{ opacity }}
    />
  );
}
