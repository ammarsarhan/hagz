import { client } from "@/lib/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, parseClientError } from "@/lib/error";

export function useReadNotificationsMutation(userId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await client.app.profile.notifications.read.$patch(userId);

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        }
    })
}

export function useNotificationsQuery(userId: string) {
    return useQuery({
        queryKey: ["notifications", userId],
        queryFn: async () => {
            const res = await client.app.profile.notifications.$get();

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 2,
        refetchInterval: 1000 * 60 * 5
    });
}