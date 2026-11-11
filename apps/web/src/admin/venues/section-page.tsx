import { EmptyState } from "@/admin/empty-section";
import { venueSections } from "./sections";

// One section of a venue's dashboard, until it's built: what it will hold and which phase brings it.
export function VenueSectionPlaceholder({ slug }: { slug: string }) {
  const section = venueSections.find((s) => s.slug === slug);
  if (!section) return null;
  return <EmptyState icon={section.icon} phase={section.phase} description={section.description} />;
}
