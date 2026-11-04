import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin.css";

// Admin web: English only, for desktop. Its own stylesheet, so the public pages don't load it.
export const metadata: Metadata = {
  title: "Hagz Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen font-sans">{children}</div>;
}
