import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import { DraftGround } from "@/lib/hooks/useGrounds";
import { DAYS_OF_WEEK, GroundScheduleDraft, toUpsertPayload } from "@/lib/types/ground";

export function useGroundSchedule(pitchId: string, groundId: string) {
    const queryClient = useQueryClient();
    const { setState } = usePitchDraftForm();

    const saveMutation = useMutation({
        mutationFn: async (draft: GroundScheduleDraft) => {
            console.log(draft['1'], draft['2'], draft['3'], draft['4'], draft['5'], draft['6'], draft['7']);

            const results = await Promise.allSettled(
                DAYS_OF_WEEK.map((day) =>
                    client.dashboard.pitches[":pitchId"].grounds[":groundId"].schedule[":dayOfWeek"].$put({
                        param: {
                            pitchId,
                            groundId,
                            dayOfWeek: String(day),
                        },
                        json: toUpsertPayload(draft[day]),
                    })
                )
            );

            for (const result of results) {
                if (result.status === "rejected") {
                    throw new Error("Some days failed to save.");
                }

                if (!result.value.ok) {
                    const error = await parseClientError(result.value);
                    throw new ApiError(error);
                }
            }
        },
        onMutate: (draft) => {
            setState((prev) => ({
                ...prev,
                grounds: prev.grounds.map((item) =>
                    (item as DraftGround).id === groundId ? { ...item, schedule: draft } : item
                ),
            }));
        },
        onSuccess: () => {
            // schedule lives on the pitch draft query — refresh it so any
            // later re-hydration of this ground reflects what was just saved
            queryClient.invalidateQueries({ queryKey: ["pitch", pitchId] });
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                Alert.alert("Couldn't save schedule", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    return { saveMutation };
};
