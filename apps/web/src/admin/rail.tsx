"use client";

import {
  IconBell,
  IconBuildingStadium,
  IconCash,
  IconHome,
  IconLifebuoy,
  IconShieldCheck,
  IconUserShield,
  IconWorldCog,
  type Icon,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdmin } from "./session";

// The sections, in the order the user set (2026-11-04), grouped (2026-11-05): an overview, the
// day-to-day work, and who has access and how the platform is set up. Unbuilt ones open an empty state.
export const groups: { label: string; items: { href: string; label: string; icon: Icon }[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Home", icon: IconHome }] },
  {
    label: "Operations",
    items: [
      { href: "/admin/venues", label: "Venues", icon: IconBuildingStadium },
      { href: "/admin/support", label: "Support", icon: IconLifebuoy },
      { href: "/admin/finance", label: "Finance", icon: IconCash },
      { href: "/admin/moderation", label: "Moderation", icon: IconShieldCheck },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/admins", label: "Admins", icon: IconUserShield },
      { href: "/admin/platform", label: "Platform", icon: IconWorldCog },
    ],
  },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

// The full-detail mark, as on the sign-in pages.
function Mark() {
  return (
    <svg
      aria-hidden
      className="size-[2.0125rem]"
      viewBox="-0.0725 -2.3325 32.595 32.595"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M7.34 8.78 L6.87 7.73 C12.35 5.29, 22 0.4, 31.6 0.8 C27.2 1.9, 23.6 3.4, 21.6 5.2 C24.2 4.3, 26.9 4.8, 29.1 6.3 C26.4 7.7, 23.7 8.9, 21.9 9.7 C23.7 9.5, 25 10.3, 25.7 11.4 C24 13.2, 21.9 13.64, 21 18.76 L19.86 18.56 A9 9 0 0 0 7.34 8.78 Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M2 17 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" strokeWidth="2.3" />
      <path d="M11 12 l4.76 3.45 l-1.76 5.55 h-6 l-1.76 -5.55 z" strokeWidth="1.8" />
      <path
        d="M11 12 v-3 M14 21 l2 2.4 M15.76 15.45 l2.9 -1.1 M7.24 21 l-2 2.3 M6.24 15.45 l-2.9 -1.1"
        strokeWidth="1.8"
      />
    </svg>
  );
}

// Snowflake's sidebar (the user's reference), always open: the mark, the grouped sections with their
// labels, then notifications and the account, which opens /admin/account (and signing out).
export function Rail() {
  const admin = useAdmin();
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  const row = "flex h-10 w-full items-center gap-3 rounded-[0.625rem] px-2.5";

  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-white px-3 py-[1.125rem]"
    >
      <div className="flex px-2.5 text-ink">
        <Mark />
      </div>
      {/* The sections scroll on their own when they don't fit; the mark and the account stay put. */}
      <div className="-mx-3 mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="mt-5 first:mt-0">
            <p className="px-2.5 pb-1.5 text-caption font-medium text-ink-3">{group.label}</p>
            <ul className="flex flex-col gap-1">
              {group.items.map(({ href, label, icon: Item }) => {
                const on = active(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={on ? "page" : undefined}
                      className={`${row} ${on ? "bg-chip text-ink" : "text-ink-2 hover:bg-chip hover:text-ink"}`}
                    >
                      <Item size={20} className="size-5 shrink-0" stroke={on ? 2 : 1.75} />
                      <span className={`text-label ${on ? "font-semibold" : "font-medium"}`}>
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          disabled
          title="Notifications come with alerts"
          className={`${row} text-ink-3`}
        >
          <IconBell size={20} className="size-5 shrink-0" stroke={1.75} />
          <span className="text-label font-medium">Notifications</span>
        </button>
        <div className="mx-2.5 my-1 h-px bg-border" />
        <Link
          href="/admin/account"
          aria-label={`Account: ${admin.name}`}
          aria-current={pathname.startsWith("/admin/account") ? "page" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-[0.625rem] p-1.5 hover:bg-chip ${pathname.startsWith("/admin/account") ? "bg-chip" : ""}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[0.75rem] font-semibold text-white">
            {initials(admin.name)}
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-label font-medium text-ink">{admin.name}</span>
            <span className="block truncate text-caption text-ink-2">{admin.email}</span>
          </span>
        </Link>
      </div>
    </nav>
  );
}
