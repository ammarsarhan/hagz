import { Redirect, router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, useWindowDimensions, View, type FlatList } from "react-native";
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
import { isRTL } from "@/lib/language";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";

// Customer onboarding: four lime slides (a problem in two words, the fix in one), swiped or
// advancing gently on their own until touched, with Get started (browse as a guest) and Create
// account on every slide; signing in lives inside the account flow. Each slide's strings live under
// screens.onboarding.<slide>; the Arabic lines need their own wordplay, not a translation.
const SLIDES = ["pitches", "free", "squads", "crews"] as const;
type Slide = (typeof SLIDES)[number];
const AUTO_ADVANCE_MS = 5000;

// The pager runs left to right; in Arabic it's flipped so the next slide comes from the left, as in
// the staff app. Builds that are natively right-to-left already scroll that way, so they aren't
// flipped twice.
const flipPager = isRTL && !I18nManager.isRTL;
const direction = isRTL ? "rtl" : "ltr";

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
  const { t } = useTranslation();
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
        <Animated.FlatList
          ref={pager}
          data={SLIDES}
          keyExtractor={(slide) => slide}
          horizontal
          pagingEnabled
          inverted={flipPager}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollBeginDrag={() => setTouched(true)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ direction: "ltr" }}
          renderItem={({ item, index: i }) => (
            <View style={{ width, direction }} className="flex-1 px-6">
              <View className="mt-13 flex-1">
                <OnboardingArt
                  index={i}
                  scene={item}
                  scrollX={scrollX}
                  pageWidth={width}
                  active={i === index}
                />
              </View>
              <Text className="mt-8 text-display font-semibold tracking-[-0.8px] text-on-primary">
                {t(`screens.onboarding.${item}.title`)}
              </Text>
              <Text className="mb-8 mt-3 text-subtitle text-on-primary-muted">
                {t(`screens.onboarding.${item}.body`)}
              </Text>
            </View>
          )}
        />

        <View className="mb-8 flex-row justify-center gap-1.5" style={{ direction }}>
          {SLIDES.map((slide, i) => (
            <Dot key={slide} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>

        <View className="gap-2.5 px-5 pb-3">
          <Button
            label={t("common.actions.getStarted")}
            variant="ink"
            onPress={() => leave("/home")}
          />
          <Button
            label={t("common.actions.createAccount")}
            variant="white"
            onPress={() => leave("/sign-up")}
          />
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
