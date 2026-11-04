"use client";

import {
  IconBell,
  IconBuildingStadium,
  IconCash,
  IconHome,
  IconLifebuoy,
  IconLogout,
  IconShieldCheck,
  IconUserShield,
  IconWorldCog,
  type Icon,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useAdmin } from "./session";

// The sections, in the order the user set (2026-11-04). Unbuilt ones open an empty state.
export const sections: { href: string; label: string; icon: Icon }[] = [
  { href: "/admin", label: "Home", icon: IconHome },
  { href: "/admin/venues", label: "Venues", icon: IconBuildingStadium },
  { href: "/admin/support", label: "Support", icon: IconLifebuoy },
  { href: "/admin/finance", label: "Finance", icon: IconCash },
  { href: "/admin/moderation", label: "Moderation", icon: IconShieldCheck },
  { href: "/admin/admins", label: "Admins", icon: IconUserShield },
  { href: "/admin/platform", label: "Platform", icon: IconWorldCog },
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
      width="28"
      height="28"
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

// Snowflake's collapsed rail (the user's reference), always narrow: the mark, the sections, then
// notifications and the account at the bottom. Labels show as tooltips.
export function Rail() {
  const admin = useAdmin();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  const square = "flex size-10 items-center justify-center rounded-[10px]";

  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 flex h-screen w-16 shrink-0 flex-col items-center border-r border-border bg-white py-[18px]"
    >
      <span className="text-ink">
        <Mark />
      </span>
      <div className="mt-4 mb-1 h-px w-6 bg-border" />
      <ul className="mt-1 flex flex-col gap-1">
        {sections.map(({ href, label, icon: Item }) => {
          const on = active(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                aria-current={on ? "page" : undefined}
                title={label}
                className={`${square} ${on ? "bg-chip text-ink" : "text-ink-2 hover:bg-chip hover:text-ink"}`}
              >
                <Item size={20} stroke={on ? 2 : 1.75} />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          disabled
          aria-label="Notifications (coming with alerts)"
          title="Notifications come with alerts"
          className={`${square} text-ink-3`}
        >
          <IconBell size={20} stroke={1.75} />
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenu(!menu)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Account: ${admin.name}`}
            className="flex cursor-pointer rounded-full p-1 hover:bg-chip"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-chip text-[12px] font-semibold text-ink">
              {initials(admin.name)}
            </span>
          </button>
          {menu ? (
            <div
              role="menu"
              className="absolute bottom-0 left-full z-20 ml-2 w-64 rounded-hud border border-border bg-white p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.12)]"
            >
              <div className="px-3 py-2">
                <p className="truncate text-label font-semibold text-ink">{admin.name}</p>
                <p className="truncate text-caption text-ink-2">{admin.email}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void signOut()}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-label font-medium text-ink hover:bg-chip"
              >
                <IconLogout size={18} stroke={1.75} />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
