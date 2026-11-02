/// <reference types="react-native-css/types" />
// expo/types declares `*.css` modules (import "../global.css"). Expo's own expo-env.d.ts references
// it too, but that file is generated on `expo start` and git-ignored, so CI never has it.
/// <reference types="expo/types" />
