// Per-weight entry points: the package index would bundle every weight and italic (about 6MB).
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { NotoSansArabic_400Regular } from "@expo-google-fonts/noto-sans-arabic/400Regular";
import { NotoSansArabic_500Medium } from "@expo-google-fonts/noto-sans-arabic/500Medium";
import { NotoSansArabic_600SemiBold } from "@expo-google-fonts/noto-sans-arabic/600SemiBold";

// Loaded once at launch (useFonts in the root layout). Each weight is its own family in Expo Go.
export const FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  NotoSansArabic_400Regular,
  NotoSansArabic_500Medium,
  NotoSansArabic_600SemiBold,
};

// The families behind font-regular, font-medium and font-semibold (@hagz/brand/staff.css), per
// language. Western digits stay in Arabic too, and Noto Sans Arabic draws them.
export const FONT_FAMILIES = {
  en: {
    "--font-family-regular": "Inter_400Regular",
    "--font-family-medium": "Inter_500Medium",
    "--font-family-semibold": "Inter_600SemiBold",
  },
  ar: {
    "--font-family-regular": "NotoSansArabic_400Regular",
    "--font-family-medium": "NotoSansArabic_500Medium",
    "--font-family-semibold": "NotoSansArabic_600SemiBold",
  },
} as const;
