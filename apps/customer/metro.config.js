// NativeWind 5 works entirely through Metro: it compiles global.css with Tailwind and swaps
// react-native imports for versions that accept `className`. No Babel plugin or native code of its
// own.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

// 1rem is 14px on native by default; 16 keeps Tailwind's scale equal to the Figma pixels
// (h-14 = 56, ms-3 = 12).
module.exports = withNativewind(getDefaultConfig(__dirname), { inlineRem: 16 });
