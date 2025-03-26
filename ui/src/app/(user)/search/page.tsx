"use client";

import { useCallback, useEffect, useState } from "react";

import Button from "@/components/button";
import Input from "@/components/input";
import { DataFilterType, useFilterContext } from "@/context/filter";

const buildQueryUrl = (filters: DataFilterType) => {
    const { startDate, endDate, minimumPrice, maximumPrice, location, radius, size, surface, amenities } = filters;
    let url = `http://localhost:3000/api/pitch?limit=10&startDate=${startDate}&endDate=${endDate}&minimumprice=${minimumPrice}&maximumprice=${maximumPrice}`;
    
    if (location.longitude && location.latitude && radius) {
        url += `&longitude=${location.longitude}&latitude=${location.latitude}&radius=${radius}`;
    }

    size.forEach(item => url += `&size=${item}`);
    surface.forEach(item => url += `&surface=${item}`);
    amenities.forEach(item => url += `&amenities=${item}`);

    return url;
}

export default function Search() {
    const { setOpen, data } = useFilterContext();
    const [view, setView] = useState<"grid" | "map">("grid");
    const [query, setQuery] = useState("");

    const handleSwitchView = () => {
        setView(view == "grid" ? "map" : "grid");
    };

    const fetchPitches = useCallback(async () => {
        const url = buildQueryUrl(data);
        console.log(url);
    }, [data]);

    useEffect(() => {
        fetchPitches();
    }, [fetchPitches])

    return (
        <div className="flex h-full mb-4 relative">
            <div className="w-full">
                <div className="w-full text-sm flex items-center gap-x-4 px-4 py-3 border-t-[1px]">
                    <Input placeholder={"Search"} value={query} onChange={(e) => setQuery(e.target.value)} className="py-2 outline-none"/>
                    <div className="flex items-center gap-x-4">
                        <Button className="text-xs text-nowrap" variant="secondary" onClick={handleSwitchView}>
                            <span className="hidden md:inline">Switch To</span> {view == "grid" ? "Map" : "Grid"} View
                        </Button>
                        <button className="text-blue-800 hover:underline text-nowrap" onClick={() => setOpen(true)}>Change Filters</button>
                    </div>
                </div>
                <div>
                    
                </div>
            </div>
        </div>
    )
};