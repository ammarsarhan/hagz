import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { language } from "@/lib/language";
import ar from "./locales/ar";
import en, { type Translations } from "./locales/en";

// The device's language for now (src/lib/language.ts); a profile setting will replace it. Set up
// synchronously when this module loads, so the first screen already has its strings.
void i18n.use(initReactI18next).init({
  resources: { en, ar },
  lng: language,
  fallbackLng: "en",
  supportedLngs: ["en", "ar"],
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Typed keys: t("screens.signIn.title") is checked, and a misspelled key is a type error.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Translations["translation"] };
  }
}

export default i18n;
