import type { ReactNode } from "react";
import "@/site/site.css";

// The public site, apart from the admin: its own stylesheet. English pages are in (en), Arabic ones
// under ar/, each in the site's frame in that language (site/shell.tsx).
export default function SiteLayout({ children }: { children: ReactNode }) {
  return children;
}
