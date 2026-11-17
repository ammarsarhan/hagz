import { detailSections } from "./detail-sections";

// A section of a venue's Details that isn't built yet: its title and what it will hold.
export function DetailPlaceholder({ slug }: { slug: string }) {
  const section = detailSections.find((s) => s.slug === slug);
  if (!section) return null;
  const { icon: Item, label, description } = section;
  return (
    <section>
      <h2 className="text-heading font-semibold text-ink">{label}</h2>
      <p className="mt-1 text-body text-ink-2">{description}</p>
      <div className="mt-8 flex flex-col items-center rounded-hud border border-dashed border-border px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-chip text-ink-2">
          <Item size={24} className="size-6" stroke={1.75} />
        </span>
        <p className="mt-4 text-body font-semibold text-ink">Coming next in Phase 2</p>
      </div>
    </section>
  );
}
