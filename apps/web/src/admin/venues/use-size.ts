"use client";

import { useEffect, useRef, useState } from "react";

// An element's size, kept up to date as the window changes: for drawings that fill their space.
export function useSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}
