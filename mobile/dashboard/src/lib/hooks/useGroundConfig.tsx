import { client } from "@/lib/client";
import { parseClientError, ApiError } from "@/lib/error";
import { useQuery } from "@tanstack/react-query";

export function useGroundConfig(pitchId: string, groundId: string) {
    return useQuery({
        queryKey: ["settings", pitchId, groundId],
        queryFn: async () => {
            const res = await client.dashboard.pitches[':pitchId'].grounds[":groundId"].config.$get({ param: { pitchId, groundId } });
            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data ?? null;
        },
        staleTime: 1000 * 60 * 2,
    });
};
