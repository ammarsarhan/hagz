import type { ReactNode } from "react";

// A titled block on a page, after the Account page (Figma A4): the title, a grey line under it, then
// what it holds. Sections after the first sit below a hairline, 32 down; siblings only, so the
// hairline rule (`[&+&]`) can see them.
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0 [&+&]:mt-8">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-label text-ink-2">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
