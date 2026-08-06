import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { parseClientError, ApiError } from "@/lib/error";
import { GroundSlotTargetType, SlotStatus } from "@/lib/types/ground";
import { format } from "date-fns";

export function useGroundSlots(pitchId: string, groundId: string, target: GroundSlotTargetType, date: Date, status?: SlotStatus) {
    return useQuery({
        queryKey: ["slots", pitchId, groundId, target, date.toDateString(), status],
        queryFn: async () => {
            const res = await client.dashboard.pitches[':pitchId'].grounds[':groundId'].slots.$get({
                param: { pitchId, groundId },
                query: { target, date: format(date, "yyyy-MM-dd"), ...(status && { status }) },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            };

            const { data } = await res.json();
            return data ?? null;
        },
        enabled: !!groundId,
        staleTime: 1000 * 30
    });
}
