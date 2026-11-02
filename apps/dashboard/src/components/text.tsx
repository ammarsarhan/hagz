import { Text as NativeText, type TextProps } from "react-native";
import { language } from "@/lib/language";

// React Native has no inherited font, so every Text gets regular weight and ink unless its classes
// say otherwise. In Arabic the weight classes become their Noto Sans Arabic versions. Use this
// instead of react-native's Text.
const WEIGHT = /\bfont-(regular|medium|semibold)\b/;
const COLOR = /\btext-(ink|ink-2|ink-3|unit|white|red|primary|on-primary)\b/;

// Spelled out in full: Tailwind only generates classes it finds written in the source.
const FONTS = {
  en: { regular: "font-regular", medium: "font-medium", semibold: "font-semibold" },
  ar: {
    regular: "font-arabic-regular",
    medium: "font-arabic-medium",
    semibold: "font-arabic-semibold",
  },
} as const;

const fontClass = (className: string) => {
  const weight = (WEIGHT.exec(className)?.[1] ?? "regular") as keyof (typeof FONTS)["en"];
  return FONTS[language][weight];
};

export function Text({ className = "", ...props }: TextProps & { className?: string }) {
  const classes = [
    fontClass(className),
    COLOR.test(className) ? "" : "text-ink",
    className.replace(WEIGHT, "").trim(),
  ];
  return <NativeText className={classes.filter(Boolean).join(" ")} {...props} />;
}
