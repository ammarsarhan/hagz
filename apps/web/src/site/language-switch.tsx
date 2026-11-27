"use client";

import { usePathname } from "next/navigation";
import { LANGUAGE_COOKIE, LANGUAGE_COOKIE_MAX_AGE } from "./language";
import { wordsFor, type Locale } from "./words";

// The footer's other language: this same page in it. English pages live at the root and Arabic ones
// under /ar, so the switch adds or drops that prefix. It remembers the pick (a cookie the proxy
// reads), so an Arabic browser that chose English isn't sent back to Arabic. The query and fragment
// go along: a confirm link's token lives in its #token=, and without it the other language's page
// can't find the week.
export function LanguageSwitch({ locale, className }: { locale: Locale; className?: string }) {
  const pathname = usePathname();
  const other = wordsFor(locale).otherLanguage;
  const href = locale === "ar" ? pathname.replace(/^\/ar(?=\/|$)/, "") || "/" : `/ar${pathname}`;
  return (
    <a
      href={href}
      lang={other.lang}
      hrefLang={other.lang}
      className={className}
      onClick={(event) => {
        event.currentTarget.href = `${href}${window.location.search}${window.location.hash}`;
        document.cookie = `${LANGUAGE_COOKIE}=${other.lang}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
      }}
    >
      {other.label}
    </a>
  );
}
