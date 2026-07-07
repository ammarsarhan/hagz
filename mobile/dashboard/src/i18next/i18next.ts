import { getLocales } from "expo-localization";
import i18n, { changeLanguage } from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";

import { getLocale as getStoredLocale, saveLocale } from "@/lib/storage";
import ar from "@/i18next/locales/ar";
import en from "@/i18next/locales/en";

const languages = ["en", "ar"] as const;
type Locale = (typeof languages)[number];

function isSupportedLocale(lang: string | null | undefined): lang is Locale {
  return !!lang && (languages as readonly string[]).includes(lang);
}

function getDeviceLocale(): Locale {
  const tag = getLocales()?.[0]?.languageTag ?? "";
  const lang = tag.split("-")[0];
  return isSupportedLocale(lang) ? lang : "ar";
}

async function resolveInitialLocale(): Promise<Locale> {
  try {
    const stored = await getStoredLocale();
    if (isSupportedLocale(stored)) return stored;
  } catch {
    // ignore storage read failures, fall through to device locale
  }
  return getDeviceLocale();
}

async function syncRTL(locale: Locale) {
  const isRTL = locale === "ar";

  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);

    if (!__DEV__) {
      try {
        const Updates = await import("expo-updates");
        await Updates.reloadAsync();
      } catch {
        // expo-updates isn't available (Expo Go without updates support), layout will apply on next natural reload instead.
      }
    }
  }
}

export async function setLocale(locale: Locale) {
  if (i18n.language !== locale) {
    await changeLanguage(locale);
  }
  try {
    await saveLocale(locale);
  } catch {
    // Non-fatal, just won't persist across restarts.
  }
  await syncRTL(locale);
}

export async function applyLocale() {
  const locale = await resolveInitialLocale();

  if (i18n.language !== locale) {
    await changeLanguage(locale);
  }

  await syncRTL(locale);
}

export async function initI18n() {
  const initialLocale = await resolveInitialLocale();

  await i18n.use(initReactI18next).init({
    resources: { en, ar },
    lng: initialLocale,
    fallbackLng: "ar",
    supportedLngs: ["en", "ar"],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

  await syncRTL(initialLocale);
}

export default i18n;
