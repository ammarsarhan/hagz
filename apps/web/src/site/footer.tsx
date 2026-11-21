import { IconBrandInstagram, IconBrandTiktok } from "@tabler/icons-react";
import { FooterBalls } from "./footer-balls";
import { Social } from "./header";
import { FOOTER_COLUMNS, LEGAL_LINKS, SOCIAL } from "./links";
import { Mark } from "./mark";
import { SiteLinkView } from "./site-link";

// The site's footer (Figma W2 rounds 3–5): light grey under the page's rounded bottom, the mark and
// four columns of links, a quiet bottom row, and the three faint balls running off the edge.
export function Footer() {
  return (
    <footer className="bg-chip pt-24">
      <div className="mx-auto w-full max-w-[1120px] px-6 xl:px-0">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          <Mark className="h-10 text-black" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title} className="flex w-[150px] flex-col gap-3.5">
                <div className="text-label text-unit">{column.title}</div>
                {column.links.map((link) => (
                  <SiteLinkView
                    key={link.label}
                    link={link}
                    className="text-[15px] leading-5 font-medium text-ink"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-[88px] flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-label text-ink-2">© Hagz 2026.</div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-5">
              {LEGAL_LINKS.map((link) => (
                <SiteLinkView key={link.label} link={link} className="text-label text-ink-2" />
              ))}
              <span lang="ar" className="text-label text-ink-2">
                العربية
              </span>
            </div>
            <div className="h-5 w-px bg-grab" />
            <div className="flex items-center gap-[18px] text-ink-2">
              <Social href={SOCIAL.instagram} label="Instagram">
                <IconBrandInstagram size={20} stroke={1.75} />
              </Social>
              <Social href={SOCIAL.tiktok} label="TikTok">
                <IconBrandTiktok size={20} stroke={1.75} />
              </Social>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-14">
        <FooterBalls />
      </div>
    </footer>
  );
}
