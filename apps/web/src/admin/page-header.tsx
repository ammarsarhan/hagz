import type { ReactNode } from "react";

// Every dashboard page starts with this: a big title, a line under it, and its actions on the right.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div>
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-body text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
