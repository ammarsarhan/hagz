"use client";

import Button from "@/components/button";
import { useFilterContext } from "@/context/filter";
import { LayoutGrid, Map } from "lucide-react";
import { useState } from "react";

export default function Featured() {
    const [currentView, setCurrentView] = useState<"grid" | "map">("grid");
    const { setOpen } = useFilterContext();

    return (
        <main className="px-6 py-4">
            <header className="flex flex-col gap-y-1">
                <h1 className="text-xl">Featured Pitches</h1>
                <p className="text-sm text-gray-500">Find your desired pitch from 100+ grounds partnered with Hagz all across Egypt.</p>
            </header>
            <div className="flex items-center justify-between mt-6 mb-8">
                <Button className="text-sm" variant="outline" onClick={() => setOpen(true)}>Filter</Button>
                <div className="flex items-center gap-x-3">
                    <button onClick={() => setCurrentView("grid")}>
                        <LayoutGrid className={`w-5 h-5 ${currentView == "grid" ? "text-black" : "text-gray-500"}`} strokeWidth={1.5}/>
                    </button>
                    <div className="h-6 w-[0.5px] bg-black"></div>
                    <button onClick={() => setCurrentView("map")}>
                        <Map className={`w-5 h-5 ${currentView == "map" ? "text-black" : "text-gray-500"}`} strokeWidth={1.5}/>
                    </button>
                </div>
                <Button className="text-sm" variant="outline">Sort</Button>
            </div>
        </main>
    )
};