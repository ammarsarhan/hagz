import { wordsFor, type Locale } from "./words";

// The official store badges (Apple's "Download on the App Store" from developer.apple.com, Google's
// "Get it on Google Play" cropped to the badge; their clear space is the gap between them). English
// in both languages for now: Apple's Arabic badge needs downloading from its marketing tools. Not
// links yet: the apps aren't in the stores, like the site's other links that wait for their pages.
export function StoreBadges({ locale }: { locale: Locale }) {
  const { manage: words } = wordsFor(locale);
  return (
    <div className="flex flex-wrap gap-3">
      <img src="/badges/app-store.svg" alt={words.appStore} className="h-11 w-auto" />
      <img src="/badges/google-play.png" alt={words.googlePlay} className="h-11 w-auto" />
    </div>
  );
}
