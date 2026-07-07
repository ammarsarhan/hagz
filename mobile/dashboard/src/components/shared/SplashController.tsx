import { useAuth } from "@/context/AuthContext";
import { initI18n } from "@/i18next/i18next";
import { SplashScreen } from "expo-router";
import { useEffect, useState } from "react";

SplashScreen.preventAutoHideAsync();

export default function SplashController() {
  const { isLoading } = useAuth();
  const [isLocaleReady, setIsLocaleReady] = useState(false);

  useEffect(() => {
    initI18n()
      .catch((error) => {
        console.error("Localization initialization failed.", error);
      })
      .finally(() => {
        setIsLocaleReady(true);
      });
  }, []);

  if (!isLoading && isLocaleReady) {
    SplashScreen.hide();
  }

  return null;
}
