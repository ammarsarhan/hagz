import { language } from "./language";

// Every string the app shows, in English and Arabic. Arabic must have exactly the same keys, so a
// missing translation is a type error rather than a blank on screen. Western digits in both.
const en = {
  styleCheckTitle: "Styling check",
  styleCheckSubtitle: "NativeWind 5 · Tailwind 4 · Expo Go",
  createAccount: "Create account",
  createVenue: "Create your venue",
  haveCode: "Have a code?",
  continue: "Continue",
  weights: "Regular, medium and semibold",
};

const ar: Record<keyof typeof en, string> = {
  styleCheckTitle: "فحص التصميم",
  styleCheckSubtitle: "NativeWind 5 · Tailwind 4 · Expo Go",
  createAccount: "إنشاء حساب",
  createVenue: "أنشئ ملعبك",
  haveCode: "لديك رمز؟",
  continue: "متابعة",
  weights: "عادي، متوسط وعريض",
};

export type MessageKey = keyof typeof en;

const messages = { en, ar }[language];

export const t = (key: MessageKey): string => messages[key];
