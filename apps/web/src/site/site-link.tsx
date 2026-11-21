import type { SiteLink } from "./links";
import type { Locale } from "./words";

// A header or footer link; one whose page doesn't exist yet is shown but not clickable.
export function SiteLinkView({
  link,
  locale,
  className,
}: {
  link: SiteLink;
  locale: Locale;
  className?: string;
}) {
  return link.href ? (
    <a href={link.href} className={className}>
      {link.label[locale]}
    </a>
  ) : (
    <span className={className}>{link.label[locale]}</span>
  );
}
