"use client";

import { useLayoutEffect, useRef, useState } from "react";

// A venue tab that fills exactly the window below the tabs, less the page's 64px bottom padding
// (main's pb-16) unless it runs over that too (bottom 0), so the page never scrolls: measured from
// where the element starts, again on every resize. Never under 320px.
export function useFillHeight<T extends HTMLElement = HTMLElement>(bottom = 64) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(320);
  useLayoutEffect(() => {
    const fit = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setHeight(Math.max(320, window.innerHeight - top - bottom));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [bottom]);
  return { ref, height };
}
