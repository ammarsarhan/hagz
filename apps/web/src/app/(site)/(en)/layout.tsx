import type { ReactNode } from "react";
import { SiteShell } from "@/site/shell";

export default function EnglishSite({ children }: { children: ReactNode }) {
  return <SiteShell locale="en">{children}</SiteShell>;
}
