import { redirect } from "next/navigation";
import { QueryClient } from "@tanstack/react-query";

import { fetchDashboard } from "@/app/utils/api/server";
import { allowedStates } from "@/app/utils/types/pitch";

export default async function ProtectedLayout({ children } : { children: React.ReactNode }) {
    const queryClient = new QueryClient();

    const { pitches } = await queryClient.fetchQuery({
        queryKey: ['dashboard'],
        queryFn: fetchDashboard
    })

    const isAllowed = pitches.find(pitch => {
        if (!pitch.status) return;
        return allowedStates.includes(pitch.status);
    });

    if (!isAllowed) {
        redirect("/dashboard");
    };

    return children;
}