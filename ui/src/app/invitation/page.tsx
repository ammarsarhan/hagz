import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"

import { fetchInvitation } from "@/app/utils/api/server";
import Wrapper from "@/app/invitation/Wrapper";

export default async function Invitation({ searchParams } : { searchParams: Promise<{ token: string }> }) {
    const { token } = await searchParams;
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ['invitation', token],
        queryFn: () => fetchInvitation(token)
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)} >
            <Wrapper token={token}/>
        </HydrationBoundary>
    )
}