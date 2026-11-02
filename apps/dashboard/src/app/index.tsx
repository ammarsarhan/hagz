import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { FlatList, I18nManager, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { ONBOARDING_ART } from "@/assets/onboarding-art";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { t, type MessageKey } from "@/lib/i18n";
import { isRTL } from "@/lib/language";

// Staff onboarding: three blue slides (a problem in two words, the fix in one), swiped or advancing
// gently on their own until touched, with Create account and Sign in on every slide.
interface Slide {
  title: MessageKey;
  body: MessageKey;
}
const SLIDES: Slide[] = [
  { title: "onboardingSchedulesTitle", body: "onboardingSchedulesBody" },
  { title: "onboardingMoneyTitle", body: "onboardingMoneyBody" },
  { title: "onboardingPitchesTitle", body: "onboardingPitchesBody" },
];
const AUTO_ADVANCE_MS = 5000;

// The pager runs left to right; in Arabic it's flipped so the next slide comes from the left. Builds
// that are natively right-to-left already scroll that way, so they aren't flipped twice.
const flipPager = isRTL && !I18nManager.isRTL;
const direction = isRTL ? "rtl" : "ltr";

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const pager = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);

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
        <FlatList
          ref={pager}
          data={SLIDES}
          keyExtractor={(slide) => slide.title}
          horizontal
          pagingEnabled
          inverted={flipPager}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollBeginDrag={() => setTouched(true)}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ direction: "ltr" }}
          renderItem={({ item, index: i }) => (
            <View style={{ width, direction }} className="flex-1 px-6">
              <View className="mt-6 flex-1 items-center justify-center">
                <SvgXml xml={ONBOARDING_ART[i] ?? null} width="100%" height="100%" />
              </View>
              <Text className="mt-8 text-display font-semibold tracking-[-0.8px] text-white">
                {t(item.title)}
              </Text>
              <Text className="mb-8 mt-3 text-subtitle text-on-primary-muted">{t(item.body)}</Text>
            </View>
          )}
        />

        <View className="mb-8 flex-row justify-center gap-1.5" style={{ direction }}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.title}
              className={`h-[7px] rounded-full bg-white ${i === index ? "w-[22px]" : "w-[7px] opacity-40"}`}
            />
          ))}
        </View>

        <View className="gap-2.5 px-5 pb-3">
          <Button
            label={t("createAccount")}
            variant="inverse"
            onPress={() => router.push("/sign-up")}
          />
          <Button
            label={t("signIn")}
            variant="inverseSecondary"
            onPress={() => router.push("/sign-in")}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
