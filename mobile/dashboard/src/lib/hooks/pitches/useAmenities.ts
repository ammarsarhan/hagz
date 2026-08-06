import { useMutation } from "@tanstack/react-query";
import { Alert } from "react-native";
import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import { Amenity } from "@/lib/types/amenity";

export type DraftAmenity = Amenity & { order?: number };

export function useAmenities(pitchId: string) {
    const { state, setState } = usePitchDraftForm();

    const createMutation = useMutation({
        mutationFn: async (amenity: Amenity) => {
            const res = await client.dashboard.pitches[":pitchId"].amenities.$post({
                param: { pitchId },
                json: amenity,
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data.amenity;
        },
        onMutate: (amenity) => {
            const previous = state.amenities;
            setState((prev) => ({ ...prev, amenities: [...prev.amenities, amenity] }));
            return { previous };
        },
        onError: (err, _amenity, context) => {
            if (context) setState((prev) => ({ ...prev, amenities: context.previous }));

            if (err instanceof ApiError) {
                Alert.alert("Couldn't add amenity", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            };
        },
        onSuccess: (amenity) => {
            const { pitchId: _pitchId, description, price, unit, ...rest } = amenity;

            const reconciled: DraftAmenity = {
                ...rest,
                description: description ?? undefined,
                price: price ?? undefined,
                unit: unit ?? undefined,
            };

            setState((prev) => ({
                ...prev,
                amenities: prev.amenities.map((item) =>
                    item.name === reconciled.name ? reconciled : item
                ),
            }));
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ order, amenity }: { order: number; amenity: Amenity }) => {
            const res = await client.dashboard.pitches[":pitchId"].amenities[":order"].$patch({
                param: { pitchId, order: String(order) },
                json: amenity,
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }
        },
        onMutate: ({ order, amenity }) => {
            const previous = state.amenities;
            setState((prev) => ({
                ...prev,
                amenities: prev.amenities.map((item) =>
                    (item as DraftAmenity).order === order ? { ...item, ...amenity } : item
                ),
            }));
            return { previous };
        },
        onError: (err, _vars, context) => {
            if (context) setState((prev) => ({ ...prev, amenities: context.previous }));

            if (err instanceof ApiError) {
                Alert.alert("Couldn't update amenity", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            };
        },
    });

    const removeMutation = useMutation({
        mutationFn: async (order: number) => {
            const res = await client.dashboard.pitches[":pitchId"].amenities[":order"].$delete({
                param: { pitchId, order: String(order) },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }
        },
        onMutate: (order) => {
            const previous = state.amenities;
            setState((prev) => {
                const remaining = prev.amenities.filter((item) => (item as DraftAmenity).order !== order);
                const sortedAndReindexed = remaining
                    .sort((a, b) => ((a as DraftAmenity).order || 0) - ((b as DraftAmenity).order || 0))
                    .map((item, index) => ({
                        ...item,
                        order: index + 1,
                    }));
                return {
                    ...prev,
                    amenities: sortedAndReindexed,
                };
            });
            return { previous };
        },
        onError: (err, _order, context) => {
            if (context) setState((prev) => ({ ...prev, amenities: context.previous }));

            if (err instanceof ApiError) {
                Alert.alert("Couldn't remove amenity", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            };
        },
    });

    return { createMutation, updateMutation, removeMutation };
}
