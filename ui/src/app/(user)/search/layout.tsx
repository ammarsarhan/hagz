import Filter from "@/components/filter";
import FilterContextProvider from "@/context/filter";

export default function SearchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FilterContextProvider>
        <div className="flex flex-col h-screen">
            <Filter/>
            {children}
        </div>
    </FilterContextProvider>
  );
}
