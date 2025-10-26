import Client from "@/app/dashboard/pitch/[id]/settings/Client";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchPitchSettings } from "@/app/utils/api/server";

export default async function Settings({
    params,
} : {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ["dashboard", "pitch", id, "settings"],
        queryFn: () => fetchPitchSettings(id),
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <Client id={id}/>
        </HydrationBoundary>
    );
};