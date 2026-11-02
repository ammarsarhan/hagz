import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, FlatList, I18nManager, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { ONBOARDING_ART } from "@/assets/onboarding-art";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { auth } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/lib/language";

// Staff onboarding: three blue slides (a problem in two words, the fix in one), swiped or advancing
// gently on their own until touched, with Create account and Sign in on every slide.
// Each slide's strings live under screens.onboarding.<slide>.
const SLIDES = ["schedules", "money", "pitches"] as const;
type Slide = (typeof SLIDES)[number];
const AUTO_ADVANCE_MS = 5000;

// The pager runs left to right; in Arabic it's flipped so the next slide comes from the left. Builds
// that are natively right-to-left already scroll that way, so they aren't flipped twice.
const flipPager = isRTL && !I18nManager.isRTL;
const direction = isRTL ? "rtl" : "ltr";

export default function Onboarding() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const pager = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  // Where the pager is, continuously, so the dots morph with the swipe instead of jumping at the end.
  const scrollX = useRef(new Animated.Value(0)).current;

  // Signed in already (the session is kept between launches): skip onboarding.
  useEffect(() => {
    void auth.isSignedIn().then((signedIn) => signedIn && router.replace("/home"));
  }, []);

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
      <StatusBar style="light" />
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
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ direction: "ltr" }}
          renderItem={({ item, index: i }) => (
            <View style={{ width, direction }} className="flex-1 px-6">
              <View className="mt-6 flex-1 items-center justify-center">
                <SvgXml xml={ONBOARDING_ART[i] ?? null} width="100%" height="100%" />
              </View>
              <Text className="mt-8 text-display font-semibold tracking-[-0.8px] text-white">
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
            label={t("common.actions.createAccount")}
            variant="inverse"
            onPress={() => router.push("/sign-up")}
          />
          <Button
            label={t("common.actions.signIn")}
            variant="inverseSecondary"
            onPress={() => router.push("/sign-in")}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

// A page dot that grows into the 22px pill as its slide scrolls into place, and shrinks back to a
// faint 7px dot as it leaves. Width can't use the native driver, so this runs in JS, which is fine
// for three small views.
function Dot({ index, scrollX, width }: { index: number; scrollX: Animated.Value; width: number }) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  return (
    <Animated.View
      style={{
        height: 7,
        borderRadius: 3.5,
        backgroundColor: "#ffffff",
        width: scrollX.interpolate({ inputRange, outputRange: [7, 22, 7], extrapolate: "clamp" }),
        opacity: scrollX.interpolate({
          inputRange,
          outputRange: [0.4, 1, 0.4],
          extrapolate: "clamp",
        }),
      }}
    />
  );
}
