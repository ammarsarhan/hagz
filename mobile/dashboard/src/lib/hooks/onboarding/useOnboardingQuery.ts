import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { useRequiredAuth } from "@/context/AuthContext";
import { parseClientError } from "@/lib/error";

// Based on the backend service layer constraints, a user may only have one pitch draft anyway, so we don't need to guard for one pitch.
// The .find() will always find exactly one submitted pitch if it exists.

export default function useSubmittedQuery() {
    const { user } = useRequiredAuth();

    const submitted = user.pitches.find(pitch => pitch.status === "SUBMITTED");

    const query = useQuery({
        queryKey: ["pitch", submitted?.pitchId],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].$get({ param: { pitchId: submitted!.pitchId } });
            if (!res.ok) {
                const error = await parseClientError(res);
                console.log(error.message);
            };

            const { data } = await res.json();
            return data.pitch;
        },
        enabled: !!submitted,
        staleTime: Infinity,
    });

    return { submitted, query };
}
