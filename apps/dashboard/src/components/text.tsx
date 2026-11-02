import { Text as NativeText, type TextProps } from "react-native";

// React Native has no inherited font, so every Text gets regular weight and ink unless its classes
// say otherwise. Use this instead of react-native's Text.
const WEIGHT = /\bfont-(regular|medium|semibold)\b/;
const COLOR = /\btext-(ink|ink-2|ink-3|unit|white|red|primary|on-primary)\b/;

export function Text({ className = "", ...props }: TextProps & { className?: string }) {
  const defaults = [
    WEIGHT.test(className) ? "" : "font-regular",
    COLOR.test(className) ? "" : "text-ink",
  ];
  return <NativeText className={[...defaults, className].filter(Boolean).join(" ")} {...props} />;
}
