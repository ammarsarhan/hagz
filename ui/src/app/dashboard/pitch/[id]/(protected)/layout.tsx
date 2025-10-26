"use client";

import { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { fetchPitchState } from "@/app/utils/api/client";
import { PitchStatus } from "@/app/utils/types/pitch";

export default function ProtectedPitchLayout({ 
    children
} : { 
    children: ReactNode
}) {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const { id } = params;
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryKey: ['dashboard', 'pitch', id],
        queryFn: () => fetchPitchState(id),
        initialData: () => queryClient.getQueryData(['dashboard', 'pitch', id])
    });

    const status = data.status as PitchStatus;

    // Guard against unallowed state.
    if (status === "APPROVED") {
        router.push(`/dashboard/pitch/${id}`);
    };

    return children;
}