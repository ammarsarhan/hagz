import { isProblem } from "@hagz/api";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hudMessage } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { goBack } from "@/lib/navigation";
import { Button } from "./button";
import { useHudAnchor } from "./hud";
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
export function FailedMessage({ error }: { error?: unknown }) {
  const { t } = useTranslation();
  const offline = error !== undefined && !isProblem(error);
  return (
    <>
      <OfflineArt />
      <Text
        accessibilityRole="header"
        className="mt-3 mb-2 text-center text-title font-semibold tracking-[-0.4px]"
      >
        {offline ? t("components.pageState.offlineTitle") : t("components.pageState.failedTitle")}
      </Text>
      <Text className="text-center text-subtitle text-ink-2">
        {offline
          ? t("components.pageState.offlineBody")
          : error !== undefined
            ? hudMessage(error)
            : t("components.pageState.failedBody")}
      </Text>
    </>
  );
}
