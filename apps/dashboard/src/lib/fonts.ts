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
