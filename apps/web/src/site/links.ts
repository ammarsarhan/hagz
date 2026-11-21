// Where the site's header and footer links go. Null: the page doesn't exist yet, so the link shows
// but isn't clickable (no dead ends). Picked by the user on 2026-11-21 (Figma W2, round 3).

export interface SiteLink {
  label: string;
  href: string | null;
}

export const HEADER_LINKS: SiteLink[] = [
  { label: "Venues", href: null },
  { label: "Owners", href: null },
  { label: "How it works", href: null },
];

export const FOOTER_COLUMNS: { title: string; links: SiteLink[] }[] = [
  {
    title: "Players",
    links: [
      { label: "Find venues", href: null },
      { label: "Get the app", href: null },
      { label: "How booking works", href: null },
      { label: "Help", href: null },
    ],
  },
  {
    title: "Venues",
    links: [
      { label: "List your venue", href: null },
      { label: "Hagz for venues", href: null },
      { label: "Book a demo", href: null },
      { label: "Venue support", href: null },
    ],
  },
  {
    title: "Cities",
    links: [
      { label: "Cairo", href: null },
      { label: "Alexandria", href: null },
      { label: "Giza", href: null },
      { label: "All cities", href: null },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: null },
      { label: "Contact us", href: null },
      { label: "Careers", href: null },
    ],
  },
];

export const LEGAL_LINKS: SiteLink[] = [
  { label: "Privacy", href: null },
  { label: "Terms", href: null },
];

// @hagzapp on both (user, 2026-11-21).
export const SOCIAL = {
  instagram: "https://www.instagram.com/hagzapp/" as string | null,
  tiktok: "https://www.tiktok.com/@hagzapp" as string | null,
};
