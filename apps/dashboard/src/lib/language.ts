import { getLocales } from "expo-localization";
import { DevSettings, I18nManager } from "react-native";

export type Language = "ar" | "en";

// The device's first language, Arabic or else English, read once at launch (changing it in the
// phone's settings relaunches the app). A language setting in the profile will replace this.
export const language: Language = getLocales()[0]?.languageCode === "ar" ? "ar" : "en";

export const isRTL = language === "ar";

// Lays the app out right-to-left in Arabic. Real builds already follow the device (expo-localization
// with supportsRTL), so this only changes anything in Expo Go, where the direction is applied on
// the next launch: reload once so the first screen is already the right way round.
export const applyLayoutDirection = () => {
  if (I18nManager.isRTL === isRTL) return;
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
  if (__DEV__) DevSettings.reload();
};
