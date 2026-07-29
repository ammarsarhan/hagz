import { client } from "@/lib/client";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";

export function useBookings(date: Date, pitchId: string, target?: string, enabled = true) {
    const startDate = startOfDay(date).toUTCString();
    const endDate = endOfDay(date).toUTCString();

    return useQuery({
        queryKey: ["bookings", pitchId, target ?? "all"],
        queryFn: async () => {
            if (target) {
                const res = await client.dashboard.pitches[":pitchId"].grounds[":groundId"].bookings.$get(
                    { 
                        query: { startDate, endDate, page: "1", limit: "24" },
                        param: { pitchId, groundId: target }
                    }
                );
    
                const { data } = await res.json();
                return data;
            } else {
                const res = await client.dashboard.pitches[":pitchId"].bookings.$get(
                    { 
                        query: { startDate, endDate, page: "1", limit: "24" },
                        param: { pitchId }
                    }
                );
    
                const { data } = await res.json();
                return data;
            }
        },
        enabled,
    });
};
