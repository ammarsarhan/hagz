import { getLocales } from "expo-localization";

export type Language = "ar" | "en";

// The device's first language, Arabic or else English, read once at launch (changing it in the
// phone's settings relaunches the app), as in the staff app. A setting in the profile will replace it.
export const language: Language = getLocales()[0]?.languageCode === "ar" ? "ar" : "en";

export const isRTL = language === "ar";

// For Intl's dates and times: Arabic month and day names with Western digits (decided 2026-10-30).
export const intlLocale = isRTL ? "ar-EG-u-nu-latn" : "en-GB";
