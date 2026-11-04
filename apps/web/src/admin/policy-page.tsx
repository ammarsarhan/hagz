import type { ReactNode } from "react";
import { Logo } from "./page-shell";

// The admin privacy policy and terms: the mark centred at the top, then small text in one column.
export function PolicyPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-10 pb-16">
      <a href="/admin/login" aria-label="Hagz Admin sign in">
        <Logo />
      </a>
      <main className="mt-14 w-full max-w-[600px] text-caption text-ink-2 [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-label [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1 [&_p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-heading font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-ink-3">{updated}</p>
        {children}
      </main>
    </div>
  );
}
