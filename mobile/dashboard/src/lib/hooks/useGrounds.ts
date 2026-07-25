import { Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import { GroundDraftType } from "@/lib/types/ground";
import { CreateGroundPayload, UpdateGroundPayload, GroundResponse } from "@/lib/types/pitch";

export type DraftGround = GroundDraftType & { id: string };

type GroundData = NonNullable<GroundResponse["data"]>["ground"];

const normalizeGround = (ground: GroundData): DraftGround => {
    const { id, name, sport, size, surface, basePrice, description, peakPrice, discountPrice } = ground;

    return {
        id,
        name,
        sport,
        size,
        surface,
        basePrice,
        description: description ?? undefined,
        peakPrice: peakPrice ?? undefined,
        discountPrice: discountPrice ?? undefined,
    };
};

export function useGrounds(pitchId: string) {
    const { state, setState } = usePitchDraftForm();

    const createMutation = useMutation({
        mutationFn: async (ground: CreateGroundPayload) => {
            const res = await client.dashboard.pitches[":pitchId"].grounds.$post({
                param: { pitchId },
                json: ground,
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data.ground;
        },
        onMutate: (ground) => {
            const previous = state.grounds;
            const tempId = Crypto.randomUUID();

            setState((prev) => ({
                ...prev,
                grounds: [...prev.grounds, { ...ground, id: tempId } as DraftGround],
            }));

            return { previous, tempId };
        },
        onError: (err, _ground, context) => {
            if (context) setState((prev) => ({ ...prev, grounds: context.previous }));

            if (err instanceof ApiError) {
                Alert.alert("Couldn't add ground", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
        onSuccess: (ground, _vars, context) => {
            const reconciled = normalizeGround(ground);

            setState((prev) => ({
                ...prev,
                grounds: prev.grounds.map((item) =>
                    (item as DraftGround).id === context?.tempId ? reconciled : item
                ),
            }));
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, ground }: { id: string; ground: UpdateGroundPayload }) => {
            const res = await client.dashboard.pitches[":pitchId"].grounds[":groundId"].$patch({
                param: { pitchId, groundId: id },
                json: ground,
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }
        },
        onMutate: ({ id, ground }) => {
            const previous = state.grounds;

            setState((prev) => ({
                ...prev,
                grounds: prev.grounds.map((item) =>
                    (item as DraftGround).id === id ? { ...item, ...ground } : item
                ),
            }));

            return { previous };
        },
        onError: (err, _vars, context) => {
            if (context) setState((prev) => ({ ...prev, grounds: context.previous }));

            if (err instanceof ApiError) {
                Alert.alert("Couldn't update ground", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await client.dashboard.pitches[":pitchId"].grounds[":groundId"].$delete({
                param: { pitchId, groundId: id },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }
        },
        onMutate: (id) => {
            const previous = state.grounds;

            setState((prev) => ({
                ...prev,
                grounds: prev.grounds.filter((item) => (item as DraftGround).id !== id),
            }));

            return { previous };
        },
        onError: (err, _id, context) => {
            if (context) setState((prev) => ({ ...prev, grounds: context.previous }));

            if (err instanceof ApiError) {
                Alert.alert("Couldn't remove ground", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    return { createMutation, updateMutation, removeMutation };
};
