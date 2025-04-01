"use client";

import Button from "@/components/button";
import Grid, { GridCardProps } from "@/components/grid";
import { buildQueryUrl, useFilterContext } from "@/context/filter";
import { LayoutGrid, Map } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function Featured() {
    const [currentView, setCurrentView] = useState<"grid" | "map">("grid");
    const [loading, setLoading] = useState(true);
    const [pitches, setPitches] = useState<GridCardProps[]>([]);

    const { setOpen, options } = useFilterContext();

    const fetchPitches = useCallback(async () => {
        setLoading(true);

        const url = buildQueryUrl(options);

        const res = await fetch(url);
        const result = await res.json();

        if (!result.success) {
            console.log("Error occurred while fetching pitches.", result.message);
            return;
        }

        setPitches(result.data.pitches);
        setLoading(false);
    }, [options])

    useEffect(() => {
        fetchPitches();
    }, [fetchPitches]);

    return (
        <main className="px-6 py-4">
            <header className="flex flex-col gap-y-1">
                <h1 className="text-xl">Featured Pitches</h1>
                <p className="text-sm text-gray-500">Find your desired pitch from 100+ grounds partnered with Hagz all across Egypt.</p>
            </header>
            <div className="flex items-center justify-between mt-8 mb-10">
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
            <section>
                {
                    currentView == "grid" ?
                    <Grid data={pitches} loading={loading}/> :
                    <></>
                }
            </section>
        </main>
    )
};