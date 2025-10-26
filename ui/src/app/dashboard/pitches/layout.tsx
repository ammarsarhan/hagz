import { ReactNode } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchPitches } from "@/app/utils/api/server";

export default async function PitchesLayout({ children } : { children : ReactNode }) {
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ["dashboard", "pitches"],
        queryFn: fetchPitches
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            {children}
        </HydrationBoundary>
    )
}