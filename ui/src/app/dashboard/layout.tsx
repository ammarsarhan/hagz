import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import DashboardShell from "@/app/components/dashboard/Shell";
import { fetchDashboard } from "@/app/utils/api/server";

export default async function DashboardLayout({ children } : { children: React.ReactNode }) {
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ["dashboard"],
        queryFn: fetchDashboard
    });
    
    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <DashboardShell>
                {children}
            </DashboardShell>
        </HydrationBoundary>
    );
}