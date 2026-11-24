import { isProblem } from "@hagz/api";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hudMessage } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { goBack } from "@/lib/navigation";
import { Button } from "./button";
import { useHudAnchor } from "./hud";
import { LIGHTS_OUT_SIZE } from "./lights-out-art";
import { BackButton } from "./nav";
import { OfflineArt } from "./offline-art";
import { Text } from "./text";

// A pushed screen whose data isn't in yet: the back button, and a spinner while it loads. When it
// couldn't be read, an error screen laid out like the blocked one: the Unplugged scene, a title and
// what happened centred above a pinned Try again. No answer at all (openapi-fetch threw, so the
// error isn't a problem from the API) reads "You're offline"; an answer that's an error gives its
// own few words under "Something went wrong".
export function PageState({
  loading = false,
  error,
  onRetry,
}: {
  loading?: boolean;
  // What failed, as `send` returned it; leave out for a plain "Something went wrong".
  error?: unknown;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer);

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, direction: isRTL ? "rtl" : "ltr" }}
    >
      <StatusBar style="dark" />
      <View className="h-10 justify-center px-4">
        <BackButton onPress={goBack} />
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (
        <>
          {/* Centred in what's left above the pinned button. */}
          <View
            className="flex-1 items-center justify-center px-6"
            style={{ paddingBottom: footer }}
          >
            <FailedMessage error={error} />
          </View>
          {onRetry ? (
            <View
              className="absolute right-0 bottom-0 left-0 px-5 pt-3"
              style={{ paddingBottom: insets.bottom + 12 }}
              onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
            >
              <Button label={t("common.actions.tryAgain")} onPress={onRetry} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

// The Unplugged scene, a title and what happened: "You're offline" when nothing answered (the
// error isn't a problem from the API), else "Something went wrong" over the API's few words. Also
// shown inside a tab whose list didn't load (Bookings), with its own Try again.
// `compact`: smaller words, for a scene fitted under a header (Search).
export function FailedMessage({
  error,
  artScale,
  compact = false,
}: {
  error?: unknown;
  artScale?: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const offline = error !== undefined && !isProblem(error);
  return (
    <>
      <OfflineArt scale={artScale} />
      <Text
        accessibilityRole="header"
        className={`mt-3 mb-2 text-center font-semibold ${compact ? "text-heading" : "text-title tracking-[-0.4px]"}`}
      >
        {offline ? t("components.pageState.offlineTitle") : t("components.pageState.failedTitle")}
      </Text>
      <Text className={`text-center text-ink-2 ${compact ? "text-body" : "text-subtitle"}`}>
        {offline
          ? t("components.pageState.offlineBody")
          : error !== undefined
            ? hudMessage(error)
            : t("components.pageState.failedBody")}
      </Text>
    </>
  );
}

// A tab that couldn't load (Search, Home): Unplugged (offline, or the API's few words) and Try again,
// under the tab's own header. It takes the room left (give it flex room: a list or scroll view
// grown to the screen, with scrolling off) and fits it exactly (user, 2026-11-24): the words and
// button at their size, the scene shrunk to what's left, never below 30%.
const ART_TOP = 24;
const ART_GAP = 24; // From the words to the button.
export function FittedFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const [room, setRoom] = useState(0);
  const [words, setWords] = useState(0);
  const [button, setButton] = useState(0);
  const { height } = LIGHTS_OUT_SIZE;
  const fits = room > 0 && words > 0 && button > 0;
  // The scene's height as it comes in FailedMessage (full size), so `words` is the rest of it.
  const scale = fits
    ? Math.max(0.3, Math.min(1, (room - ART_TOP - words - ART_GAP - button) / height))
    : 1;
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      className="flex-1"
      onLayout={(event) => setRoom(event.nativeEvent.layout.height)}
    >
      {/* Hidden for the frame it takes to measure, so it never shows at the wrong size. */}
      <View className="items-center px-2" style={{ paddingTop: ART_TOP, opacity: fits ? 1 : 0 }}>
        <View
          className="items-center"
          onLayout={(event) => setWords(event.nativeEvent.layout.height - height * scale)}
        >
          <FailedMessage error={error} artScale={scale} compact />
        </View>
        <View
          style={{ marginTop: ART_GAP }}
          onLayout={(event) => setButton(event.nativeEvent.layout.height)}
        >
          <Button label={t("common.actions.tryAgain")} size="compact" onPress={onRetry} />
        </View>
      </View>
    </Animated.View>
  );
}
