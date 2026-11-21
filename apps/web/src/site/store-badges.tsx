import { IconBrandAppleFilled, IconBrandGooglePlay } from "@tabler/icons-react";
import { wordsFor, type Locale } from "./words";

// The two store badges (Figma W3). Not links yet: the apps aren't in the stores, like the site's
// other links that wait for their pages (links.ts).
export function StoreBadges({ locale }: { locale: Locale }) {
  const { manage: words } = wordsFor(locale);
  const badges = [
    { ...words.appStore, icon: <IconBrandAppleFilled size={22} /> },
    { ...words.googlePlay, icon: <IconBrandGooglePlay size={20} stroke={1.75} /> },
  ];
  return (
    <div className="flex flex-wrap gap-2.5">
      {badges.map((badge) => (
        <span
          key={badge.name}
          className="flex h-11 items-center gap-2 rounded-[10px] bg-ink ps-3 pe-3.5 text-white"
        >
          {badge.icon}
          <span className="flex flex-col">
            <span className="text-[10px] leading-3">{badge.small}</span>
            <span dir="ltr" className="text-subtitle leading-[18px] font-semibold">
              {badge.name}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
