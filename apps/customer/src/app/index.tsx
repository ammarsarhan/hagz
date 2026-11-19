import { Redirect, router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View, type FlatList } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { OnboardingArt } from "@/components/onboarding-art";
import { Text } from "@/components/text";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";

// Customer onboarding: four lime slides (a problem in two words, the fix in one), swiped or
// advancing gently on their own until touched, with Create account and Sign in on every slide and
// Skip for browsing as a guest. English only until the customer app gets its translations; the
// Arabic lines need their own wordplay, not a translation.
const SLIDES = [
  {
    key: "pitches",
    title: "Pitch hunting,\nhandled.",
    body: "See free slots at venues near you and book in a few taps. No more calling around.",
  },
  {
    key: "free",
    title: "Frequent fixtures,\nfree.",
    body: "Venues reward their regulars: keep booking and your stamps add up to a free game.",
  },
  {
    key: "squads",
    title: "Short squads,\nsolved.",
    body: "Open your game to players nearby, or join one that’s a couple short.",
  },
  {
    key: "crews",
    title: "Kickabout crews,\ncrowned.",
    body: "Turn your weekly game into a community and play for the cup in tournaments.",
  },
] as const;
type Slide = (typeof SLIDES)[number];
const AUTO_ADVANCE_MS = 5000;

export default function Index() {
  if (hasSeenOnboarding()) return <Redirect href="/home" />;
  return <Onboarding />;
}

function leave(to: Href) {
  markOnboardingSeen();
  if (to === "/home") router.replace(to);
  else router.push(to);
}

function Onboarding() {
  const { width } = useWindowDimensions();
  const pager = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  // Where the pager is, on the UI thread, so the dots and the drawings move with the finger.
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  useEffect(() => {
    if (touched || index >= SLIDES.length - 1) return;
    const timer = setTimeout(
      () => pager.current?.scrollToIndex({ index: index + 1, animated: true }),
      AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [index, touched]);

  return (
    <View className="flex-1 bg-primary">
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>
        <View className="h-11 flex-row items-center justify-end px-6">
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => leave("/home")}
            className="active:opacity-60"
          >
            <Text className="text-subtitle font-medium text-on-primary">Skip</Text>
          </Pressable>
        </View>

        <Animated.FlatList
          ref={pager}
          data={SLIDES}
          keyExtractor={(slide) => slide.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollBeginDrag={() => setTouched(true)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width }} className="flex-1 px-6">
              <View className="mt-2 flex-1">
                <OnboardingArt
                  index={i}
                  scene={item.key}
                  scrollX={scrollX}
                  pageWidth={width}
                  active={i === index}
                />
              </View>
              <Text className="mt-8 text-display font-semibold tracking-[-0.8px] text-on-primary">
                {item.title}
              </Text>
              <Text className="mb-8 mt-3 text-subtitle text-on-primary-muted">{item.body}</Text>
            </View>
          )}
        />

        <View className="mb-8 flex-row justify-center gap-1.5">
          {SLIDES.map((slide, i) => (
            <Dot key={slide.key} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>

        <View className="gap-2.5 px-5 pb-3">
          <Button label="Create account" variant="ink" onPress={() => leave("/sign-up")} />
          <Button label="Sign in" variant="white" onPress={() => leave("/sign-in")} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// A page dot that grows into the 22px pill as its slide scrolls into place, and shrinks back to a
// faint 7px dot as it leaves.
function Dot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, range, [7, 22, 7], "clamp"),
      opacity: interpolate(scrollX.value, range, [0.22, 1, 0.22], "clamp"),
    };
  });
  return <Animated.View className="h-[7px] rounded-full bg-on-primary" style={style} />;
}
