import { getLocales } from "expo-localization";

export type Language = "ar" | "en";

// The device's first language, Arabic or else English, read once at launch (changing it in the
// phone's settings relaunches the app). A language setting in the profile will replace this.
export const language: Language = getLocales()[0]?.languageCode === "ar" ? "ar" : "en";

export const isRTL = language === "ar";
