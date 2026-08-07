import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export interface UsePayoutsOptions {
    status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    page?: number;
    limit?: number;
}

export function usePayouts(
    pitchId: string,
    options?: UsePayoutsOptions,
    enabled = true
) {
    return useQuery({
        queryKey: ["payouts", "list", pitchId, options],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].payouts.$get({
                param: { pitchId },
                query: {
                    status: options?.status,
                    page: options?.page ? String(options.page) : undefined,
                    limit: options?.limit ? String(options.limit) : "10",
                },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data ?? null;
        },
        enabled: enabled && !!pitchId,
        staleTime: 1000 * 60 * 2,
    });
}

export function useInfinitePayouts(
    pitchId: string,
    options?: Omit<UsePayoutsOptions, "page">,
    enabled = true
) {
    return useInfiniteQuery({
        queryKey: ["payouts", "infinite", pitchId, options],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await client.dashboard.pitches[":pitchId"].payouts.$get({
                param: { pitchId },
                query: {
                    status: options?.status,
                    page: String(pageParam),
                    limit: options?.limit ? String(options.limit) : "10",
                },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data;
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (!lastPage || !lastPage.pagination) return undefined;
            const { page, totalPages } = lastPage.pagination;
            return page < totalPages ? page + 1 : undefined;
        },
        enabled: enabled && !!pitchId,
        staleTime: 1000 * 60 * 2,
    });
}
