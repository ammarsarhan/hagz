"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { detailHref, detailSections } from "@/admin/venues/detail-sections";

// A venue's Details tab: its sections in a menu on the left, each a page of its own, the open one on
// the right (Figma A6, option 5). The menu's rows are the rail's, a size for a column of a page.
export default function VenueDetailsLayout({ children }: { children: ReactNode }) {
  const { venueId } = useParams<{ venueId: string }>();
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-[14rem_minmax(0,1fr)] items-start gap-14">
      <nav aria-label="Details sections" className="sticky top-8">
        <ul className="flex flex-col gap-1">
          {detailSections.map(({ slug, label, icon: Item }) => {
            const href = detailHref(venueId, slug);
            const on = pathname === href;
            return (
              <li key={slug}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-10 items-center gap-3 rounded-[0.625rem] px-2.5 ${
                    on ? "bg-chip text-ink" : "text-ink-2 hover:bg-chip hover:text-ink"
                  }`}
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
      </nav>
      <div>{children}</div>
    </div>
  );
}
