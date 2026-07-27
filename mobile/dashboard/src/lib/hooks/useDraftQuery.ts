import { useMutation, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { useAuth, useRequiredAuth } from "@/context/AuthContext";
import { ApiError, parseClientError } from "@/lib/error";
import { Alert } from "react-native";

export default function useDraftQuery() {
    const { user } = useRequiredAuth();
    const { setUser } = useAuth();

    const draft = user.pitches.find(pitch => pitch.status === "DRAFT");

    const query = useQuery({
        queryKey: ["pitch", draft?.pitchId],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].$get({ param: { pitchId: draft!.pitchId } });
            if (!res.ok) {
                const error = await parseClientError(res);
                console.log(error.message);
            };

            const { data } = await res.json();
            return data.pitch;
        },
        enabled: !!draft,
        staleTime: Infinity,
    });

    const submit = useMutation({
        mutationKey: ["pitch", draft?.pitchId],
        mutationFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].submit.$post({ param: { pitchId: draft!.pitchId }});
            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            };

            const { data } = await res.json();
            return data.profile;
        },
        onSuccess: (profile) => {
            setUser(profile);
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                Alert.alert("Failed to submit pitch", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    return { draft, query, submit };
}