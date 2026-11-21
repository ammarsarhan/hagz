"use client";

import { usePathname } from "next/navigation";
import { wordsFor, type Locale } from "./words";

// The footer's other language: this same page in it. English pages live at the root and Arabic ones
// under /ar, so the switch adds or drops that prefix.
export function LanguageSwitch({ locale, className }: { locale: Locale; className?: string }) {
  const pathname = usePathname();
  const other = wordsFor(locale).otherLanguage;
  const href = locale === "ar" ? pathname.replace(/^\/ar(?=\/|$)/, "") || "/" : `/ar${pathname}`;
  return (
    <a href={href} lang={other.lang} hrefLang={other.lang} className={className}>
      {other.label}
    </a>
  );
}
