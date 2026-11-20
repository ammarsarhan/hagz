import { Text as NativeText, type TextProps } from "react-native";

// React Native has no inherited text style, so every Text gets normal weight and ink unless its
// classes say otherwise. The font is the system's (SF Pro, SF Arabic, Roboto). Use this instead of
// react-native's Text.
const WEIGHT = /\bfont-(normal|medium|semibold)\b/;
const COLOR = /\btext-(ink|ink-2|ink-3|unit|red|white|on-primary|on-primary-muted|accent)\b/;

export function Text({ className = "", ...props }: TextProps & { className?: string }) {
  const classes = [
    WEIGHT.test(className) ? "" : "font-normal",
    COLOR.test(className) ? "" : "text-ink",
    className,
  ];
  return <NativeText className={classes.filter(Boolean).join(" ")} {...props} />;
}
