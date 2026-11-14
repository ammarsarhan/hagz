import { Text as NativeText, type TextProps } from "react-native";
import { language } from "@/lib/language";

// React Native has no inherited text style, so every Text gets normal weight and ink unless its
// classes say otherwise. The font is the system's (SF Pro, SF Arabic, Roboto). Use this instead of
// react-native's Text.
const WEIGHT = /\bfont-(normal|medium|semibold)\b/;
const COLOR =
  /\btext-(ink|ink-2|ink-3|unit|white|red|green|primary|primary-soft|on-primary|on-primary-muted|on-ink-muted)\b/;

export function Text({ className = "", style, ...props }: TextProps & { className?: string }) {
  const classes = [
    WEIGHT.test(className) ? "" : "font-normal",
    COLOR.test(className) ? "" : "text-ink",
    className,
  ];
  return (
    <NativeText
      className={classes.filter(Boolean).join(" ")}
      // No textAlign: inside Screen's right-to-left layout, the default ("natural") already starts
      // at the right, while an explicit "right" is mirrored to the left. The writing direction keeps
      // Latin words and punctuation in the right order inside Arabic sentences.
      style={language === "ar" ? [{ writingDirection: "rtl" }, style] : style}
      {...props}
    />
  );
}
