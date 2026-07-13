import { useAuth } from "@/context/AuthContext";
import { initI18n } from "@/i18next/i18next";
import { SplashScreen } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import RootNavigator from "@/components/shared/RootNavigator";

SplashScreen.preventAutoHideAsync();

export default function AppLayout() {
  const { isLoading } = useAuth();
  const [isLocaleReady, setIsLocaleReady] = useState(false);

  useEffect(() => {
    initI18n()
      .catch((error) => {
        console.error("Localization initialization failed.", error);
      })
      .finally(() => setIsLocaleReady(true));
  }, []);

  const isReady = !isLoading && isLocaleReady;

  const onLayoutRootView = useCallback(() => {
    if (isReady) {
      SplashScreen.hide();
    }
  }, [isReady]);

  if (!isReady) {
    // Splash screen still covers the screen — nothing painted underneath yet.
    return null;
  }

  return (
    <View className="flex-1" onLayout={onLayoutRootView}>
      <RootNavigator />
    </View>
  );
}
