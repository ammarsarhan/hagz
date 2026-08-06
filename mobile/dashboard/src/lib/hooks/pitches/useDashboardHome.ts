import { client } from "@/lib/client";
import { parseClientError, ApiError } from "@/lib/error";
import { useQuery } from "@tanstack/react-query";

export function useDashboardHome(pitchId: string, enabled = true) {
    return useQuery({
        queryKey: ["home", pitchId],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].dashboard.$get(
                { param: { pitchId } }
            );

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data?.pitch ?? null;
        },
        enabled,
        staleTime: 1000 * 60 * 2,
    });
}
