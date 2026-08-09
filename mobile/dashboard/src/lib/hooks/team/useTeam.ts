import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";
import { StaffMember, Invitation } from "@/lib/types/team";
import { useQuery } from "@tanstack/react-query";

export function usePitchStaff(pitchId: string, enabled = true) {
    return useQuery({
        queryKey: ["team", "staff", pitchId],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].team.$get({
                param: { pitchId },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return (data?.staff ?? []) as StaffMember[];
        },
        enabled: enabled && !!pitchId,
        staleTime: 1000 * 60 * 2,
    });
}

export function usePitchInvitations(pitchId: string, enabled = true) {
    return useQuery({
        queryKey: ["team", "invitations", pitchId],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].team.invitations.$get({
                param: { pitchId },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return (data?.invitations ?? []) as Invitation[];
        },
        enabled: enabled && !!pitchId,
        staleTime: 1000 * 60 * 2,
    });
}
