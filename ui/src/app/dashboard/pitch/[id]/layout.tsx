import { ReactNode } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import PitchShell from "@/app/dashboard/pitch/[id]/Shell";
import { fetchPitchState } from "@/app/utils/api/server";

export default async function PitchLayout({
    params,
    children
} : {
    params: Promise<{ id: string }>,
    children: ReactNode
}) {
    const { id } = await params;
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ['dashboard', 'pitch', id],
        queryFn: () => fetchPitchState(id)
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <PitchShell id={id}>
                {children}
            </PitchShell>
        </HydrationBoundary>
    )
}