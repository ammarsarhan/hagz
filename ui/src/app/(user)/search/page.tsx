"use client";

import { useState } from "react";

import Button from "@/components/button";
import Input from "@/components/input";
import { useFilterContext } from "@/context/filter";

export default function Search() {
    const { setOpen } = useFilterContext();
    const [view, setView] = useState<"grid" | "map">("grid");

    const handleSwitchView = () => {
        setView(view == "grid" ? "map" : "grid");
    }

    return (
        <div className="flex h-full mb-4 relative">
            <div className="w-full">
                <div className="w-full text-sm flex items-center gap-x-8 px-4 py-3 border-t-[1px]">
                    <Input placeholder={"Search"} value={""} onChange={() => {}} className="py-2"/>
                    <div className="flex items-center gap-x-4">
                        <Button className="text-xs text-nowrap" variant="secondary" onClick={handleSwitchView}>
                            Switch To {view == "grid" ? "Map" : "Grid"} View
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