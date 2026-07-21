import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { useRequiredAuth } from "@/context/AuthContext";

export default function useDraftQuery() {
    const { user } = useRequiredAuth();

    const draft = user.pitches.find(pitch => pitch.status === "DRAFT");

    const query = useQuery({
        queryKey: ["pitch", draft?.pitchId],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].$get({ param: { pitchId: draft!.pitchId } });
            if (!res.ok) throw new Error("Failed to load draft pitch.");
            const { data } = await res.json();
            return data.pitch;
        },
        enabled: !!draft,
        staleTime: Infinity,
    });

    return { draft, query };
}