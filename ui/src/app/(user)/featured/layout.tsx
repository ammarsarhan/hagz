"use client";

import Filter from "@/components/filter";
import FilterContextProvider from "@/context/filter";

export default function FeaturedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FilterContextProvider>
        <Filter/>
        {children}
    </FilterContextProvider>
  );
}
