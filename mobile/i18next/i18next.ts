import { I18nManager } from 'react-native';
import { getLocales } from 'expo-localization';
import i18n, { changeLanguage } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18next/locales/en';
import ar from '@/i18next/locales/ar';

export const Language = {
  EN: 'EN',
  AR: 'AR'
} as const

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Language = (typeof Language)[keyof typeof Language]
type Locale = (typeof languages)[number];

const languages = ['en', 'ar'] as const;

const languageToLocale: Record<Language, Locale> = {
    [Language.EN]: 'en',
    [Language.AR]: 'ar',
};

function isSupportedLocale(lang: string): lang is Locale {
    return (languages as readonly string[]).includes(lang);
}

function getDeviceLocale(): Locale {
    const tag = getLocales()?.[0]?.languageTag ?? '';
    const lang = tag.split('-')[0];
    return isSupportedLocale(lang) ? lang : 'ar';
}

const deviceLocale = getDeviceLocale();

export async function applyLocale(preferred?: Language | null) {
    const locale = (preferred != null ? languageToLocale[preferred] : null) ?? getDeviceLocale();

    if (i18n.language !== locale) {
        await changeLanguage(locale);
    }

    const isRTL = locale === 'ar';

    if (I18nManager.isRTL !== isRTL) {
        I18nManager.allowRTL(isRTL);
        I18nManager.forceRTL(isRTL);

        if (!__DEV__) {
            const Updates = await import('expo-updates');
            await Updates.reloadAsync();
        }
    }
}

i18n
.use(initReactI18next)
.init({
    resources: { en, ar },
    lng: deviceLocale,
    fallbackLng: 'ar',
    supportedLngs: ['en', 'ar'],
    interpolation: {
        escapeValue: false,
    },
});

applyLocale();
export default i18n;