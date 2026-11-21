import type { Locale } from "./words";

// Where the site's header and footer links go. Null: the page doesn't exist yet, so the link shows
// but isn't clickable (no dead ends). Picked by the user on 2026-11-21 (Figma W2, round 3).

// Each label in both languages (words.ts has the rest of the site's words).
export type Label = Record<Locale, string>;

export interface SiteLink {
  label: Label;
  href: string | null;
}

export const HEADER_LINKS: SiteLink[] = [
  { label: { en: "Venues", ar: "الملاعب" }, href: null },
  { label: { en: "Owners", ar: "لأصحاب الملاعب" }, href: null },
  { label: { en: "How it works", ar: "كيف يعمل" }, href: null },
];

export const FOOTER_COLUMNS: { title: Label; links: SiteLink[] }[] = [
  {
    title: { en: "Players", ar: "اللاعبون" },
    links: [
      { label: { en: "Find venues", ar: "ابحث عن ملعب" }, href: null },
      { label: { en: "Get the app", ar: "حمّل التطبيق" }, href: null },
      { label: { en: "How booking works", ar: "كيف يتم الحجز" }, href: null },
      { label: { en: "Help", ar: "المساعدة" }, href: null },
    ],
  },
  {
    title: { en: "Venues", ar: "أصحاب الملاعب" },
    links: [
      { label: { en: "List your venue", ar: "أضف ملعبك" }, href: null },
      { label: { en: "Hagz for venues", ar: "حجز للملاعب" }, href: null },
      { label: { en: "Book a demo", ar: "اطلب عرضًا تجريبيًا" }, href: null },
      { label: { en: "Venue support", ar: "دعم الملاعب" }, href: null },
    ],
  },
  {
    title: { en: "Cities", ar: "المدن" },
    links: [
      { label: { en: "Cairo", ar: "القاهرة" }, href: null },
      { label: { en: "Alexandria", ar: "الإسكندرية" }, href: null },
      { label: { en: "Giza", ar: "الجيزة" }, href: null },
      { label: { en: "All cities", ar: "كل المدن" }, href: null },
    ],
  },
  {
    title: { en: "Company", ar: "الشركة" },
    links: [
      { label: { en: "About", ar: "من نحن" }, href: null },
      { label: { en: "Contact us", ar: "تواصل معنا" }, href: null },
      { label: { en: "Careers", ar: "الوظائف" }, href: null },
    ],
  },
];

export const LEGAL_LINKS: SiteLink[] = [
  { label: { en: "Privacy", ar: "الخصوصية" }, href: null },
  { label: { en: "Terms", ar: "الشروط" }, href: null },
];

// @hagzapp on both (user, 2026-11-21).
export const SOCIAL = {
  instagram: "https://www.instagram.com/hagzapp/" as string | null,
  tiktok: "https://www.tiktok.com/@hagzapp" as string | null,
};
