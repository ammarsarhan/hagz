// NativeWind 5 works entirely through Metro: it compiles global.css with Tailwind and swaps
// react-native imports for versions that accept `className`. No Babel plugin or native code, so the
// app still runs in Expo Go.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

// 1rem is 14px on native by default; 16 keeps Tailwind's scale equal to the Figma pixels
// (h-14 = 56, ms-3 = 12). Variables are inlined at build time except the font families, which the
// app swaps at runtime for Arabic (FONT_FAMILIES in src/lib/fonts.ts).
module.exports = withNativewind(getDefaultConfig(__dirname), {
  inlineRem: 16,
  inlineVariables: {
    exclude: ["--font-family-regular", "--font-family-medium", "--font-family-semibold"],
  },
});
