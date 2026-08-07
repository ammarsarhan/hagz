import { client } from "@/lib/client";
import { parseClientError, ApiError } from "@/lib/error";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";

export function useBookings(date: Date, pitchId: string, target?: string, enabled = true) {
    const startDate = startOfDay(date).toISOString();
    const endDate = endOfDay(date).toISOString();

    return useQuery({
        queryKey: ["bookings", pitchId, target ?? "all", startOfDay(date).getTime()],
        queryFn: async () => {
            if (target) {
                const res = await client.dashboard.pitches[":pitchId"].grounds[":groundId"].bookings.$get(
                    { 
                        query: { startDate, endDate, page: "1", limit: "24" },
                        param: { pitchId, groundId: target }
                    }
                );
    
                if (!res.ok) {
                    const error = await parseClientError(res);
                    throw new ApiError(error);
                }

                const { data } = await res.json();
                return data ?? null;
            } else {
                const res = await client.dashboard.pitches[":pitchId"].bookings.$get(
                    { 
                        query: { startDate, endDate, page: "1", limit: "24" },
                        param: { pitchId }
                    }
                );
    
                if (!res.ok) {
                    const error = await parseClientError(res);
                    throw new ApiError(error);
                }

                const { data } = await res.json();
                return data ?? null;
            }
        },
        enabled,
        staleTime: 1000 * 60 * 2,
        refetchInterval: 1000 * 60 * 2
    });
}
