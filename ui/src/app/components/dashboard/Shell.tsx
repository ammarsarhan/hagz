"use client";

import { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Aside from "@/app/components/dashboard/Aside";
import Navigation from "@/app/components/dashboard/Navigation";
import { fetchDashboard } from "@/app/utils/api/client";

export default function DashboardShell({ children } : { children: ReactNode }) {
    const queryClient = useQueryClient();
    
    const { data } = useQuery({
        queryKey: ["dashboard"],
        queryFn: fetchDashboard,
        initialData: () => queryClient.getQueryData(["dashboard"])
    });

    if (!data) return null;
    const { user, stage, pitches } = data;
    
    return (
        <div className="flex h-screen">
            <Aside stage={stage}/>
            <div className="flex flex-col h-full w-full">
                <Navigation pitches={pitches} user={user}/>
                <main className="absolute top-16 right-0 w-full lg:w-[calc(100%-14rem)] h-[calc(100vh-4rem)] text-sm">
                    {children}
                </main>
            </div>
        </div>
    )
};