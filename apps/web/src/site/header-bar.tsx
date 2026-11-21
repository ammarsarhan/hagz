"use client";

import { useEffect, useState, type ReactNode } from "react";

// The header stays at the top of the window; once the page scrolls under it, a faint hairline
// separates the two.
export function HeaderBar({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <div
      className={`sticky top-0 z-20 border-b bg-white transition-colors duration-200 ${scrolled ? "border-hairline" : "border-transparent"}`}
    >
      {children}
    </div>
  );
}
