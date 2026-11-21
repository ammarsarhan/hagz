import { IconBrandInstagram, IconBrandTiktok } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { HEADER_LINKS, SOCIAL } from "./links";
import { HeaderBar } from "./header-bar";
import { Mark } from "./mark";
import { SiteLinkView } from "./site-link";

// The site's header (Mobbin's, Figma W2 round 3), fixed at the top: the black mark, no tile, with three links beside it; the
// socials, a hairline and the one action on the right. No border under it.
export function Header() {
  return (
    <HeaderBar>
      <header className="mx-auto flex h-[88px] w-full max-w-[1120px] items-center justify-between px-6 xl:px-0">
        <div className="flex items-center gap-8">
          <a href="/" aria-label="Hagz" className="text-black">
            <Mark className="h-[30px]" label="" />
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            {HEADER_LINKS.map((link) => (
              <SiteLinkView key={link.label} link={link} className="text-subtitle font-medium" />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-5 md:flex">
            <Social href={SOCIAL.instagram} label="Instagram">
              <IconBrandInstagram size={22} stroke={1.75} />
            </Social>
            <Social href={SOCIAL.tiktok} label="TikTok">
              <IconBrandTiktok size={22} stroke={1.75} />
            </Social>
          </div>
          <div className="hidden h-6 w-px bg-border md:block" />
          <a
            href="#get-the-app"
            className="flex h-10 items-center rounded-full bg-[#1d1d1d] px-[18px] text-[15px] font-semibold text-white"
          >
            Get the app
          </a>
        </div>
      </header>
    </HeaderBar>
  );
}

export function Social({
  href,
  label,
  className,
  children,
}: {
  href: string | null;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return href ? (
    <a href={href} aria-label={label} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <span aria-label={label} className={className}>
      {children}
    </span>
  );
}
