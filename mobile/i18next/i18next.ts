import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import en from '@/i18next/locales/en';
import ar from '@/i18next/locales/ar';

const deviceLanguage = getLocales()[0].languageCode ?? 'en';

i18n
    .use(initReactI18next)
    .init({ 
        resources: {en, ar},
        lng: deviceLanguage,
        fallbackLng: "en",
        supportedLngs: ["en", "ar"],
        interpolation: {
            escapeValue: false
        }
    })

export const isRTL = getLocales()[0].textDirection === "rtl";
I18nManager.allowRTL(isRTL);
I18nManager.forceRTL(isRTL);

export default i18n;