import { useQuery } from "@tanstack/react-query";
import { InferResponseType } from "hono/client";
import { client } from "@/lib/client";
import { parseClientError, ApiError } from "@/lib/error";

type AvailabilityRequest = (typeof client.dashboard.pitches)[":pitchId"]["availability"];
export type AvailabilityResponse = InferResponseType<AvailabilityRequest["$get"]>;
export type AvailabilityDay = AvailabilityResponse["data"]["availability"]["availability"][number];

async function fetchAvailability(pitchId: string, target?: string): Promise<AvailabilityResponse["data"]["availability"]> {
    const res = await client.dashboard.pitches[":pitchId"].availability.$get({
        param: { pitchId },
        query: target ? { target } : {},
    });

    if (!res.ok) {
        const error = await parseClientError(res);
        throw new ApiError(error);
    }

    const { data } = await res.json();
    return data.availability;
}

export function usePitchAvailability(pitchId: string, target: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: ["availability", pitchId, target ?? "all"],
        queryFn: () => fetchAvailability(pitchId, target),
        staleTime: 1000 * 60 * 2,
        enabled: !!pitchId && enabled,
    });
}
