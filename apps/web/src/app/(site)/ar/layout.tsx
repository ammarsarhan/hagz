import type { ReactNode } from "react";
import { SiteShell } from "@/site/shell";

// The site in Arabic, right to left, at the same paths under /ar.
export default function ArabicSite({ children }: { children: ReactNode }) {
  return <SiteShell locale="ar">{children}</SiteShell>;
}
