import type { Icon } from "@tabler/icons-react";
import { PageHeader } from "./page-header";

// A section that's in the navigation but not built yet: what it will hold, and which phase brings it.
export function EmptySection({
  title,
  subtitle,
  ...state
}: {
  title: string;
  subtitle: string;
} & EmptyStateProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mt-8">
        <EmptyState {...state} />
      </div>
    </>
  );
}

interface EmptyStateProps {
  icon: Icon;
  phase: string;
  description: string;
}

// The dashed box on its own, for a section under a header of its own (a venue's sections).
export function EmptyState({ icon: Item, phase, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-hud border border-dashed border-border px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-chip text-ink-2">
        <Item size={24} className="size-6" stroke={1.75} />
      </span>
      <p className="mt-4 text-body font-semibold text-ink">Coming in {phase}</p>
      <p className="mt-1 max-w-[27.5rem] text-label text-ink-2">{description}</p>
    </div>
  );
}
