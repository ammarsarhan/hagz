import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchPitch } from "@/app/utils/api/server";
import Client from "@/app/dashboard/pitch/[id]/(overview)/Client";

export default async function Details({
    params
} : {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ['dashboard', 'pitch', id, 'home'],
        queryFn: () => fetchPitch(id)
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <Client id={id}/>
        </HydrationBoundary>
    )
}