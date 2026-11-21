import type { SiteLink } from "./links";

// A header or footer link; one whose page doesn't exist yet is shown but not clickable.
export function SiteLinkView({ link, className }: { link: SiteLink; className?: string }) {
  return link.href ? (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  ) : (
    <span className={className}>{link.label}</span>
  );
}
