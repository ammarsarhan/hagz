import { ReactNode } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchPitchBookingConstraints } from "@/app/utils/api/server";

export default async function PitchBookingsLayout({ children, params } : { children: ReactNode, params: Promise<{ id: string }> }) {

    const { id } = await params;
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ["dashboard", "pitch", id, "bookings", "constraints"],
        queryFn: () => fetchPitchBookingConstraints(id)
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            {children}
        </HydrationBoundary>
    )
};
