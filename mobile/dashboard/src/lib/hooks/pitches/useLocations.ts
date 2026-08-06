import { client } from "@/lib/client";
import { useQuery } from "@tanstack/react-query";

export function useLocations(enabled = true) {
    return useQuery({
        queryKey: ["locations"],
        queryFn: async () => {
            const res = await client.locations.$get();
            const { data } = await res.json();
            return data;
        },
        enabled,
    });
}
