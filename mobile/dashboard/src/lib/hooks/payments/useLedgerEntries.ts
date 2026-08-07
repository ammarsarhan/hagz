import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";
import { LedgerAction } from "@/lib/types/payments";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface UseLedgerEntriesOptions {
    type?: LedgerAction;
    bookingId?: string;
    payoutId?: string;
    page?: number;
    limit?: number;
}

export function useLedgerEntries(
    pitchId: string,
    options?: UseLedgerEntriesOptions,
    enabled = true
) {
    return useQuery({
        queryKey: ["ledgers", "list", pitchId, options],
        queryFn: async () => {
            const res = await client.dashboard.pitches[":pitchId"].ledgers.$get({
                param: { pitchId },
                query: {
                    type: options?.type as any,
                    bookingId: options?.bookingId,
                    payoutId: options?.payoutId,
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

export function useInfiniteLedgerEntries(
    pitchId: string,
    options?: Omit<UseLedgerEntriesOptions, "page">,
    enabled = true
) {
    return useInfiniteQuery({
        queryKey: ["ledgers", "infinite", pitchId, options],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await client.dashboard.pitches[":pitchId"].ledgers.$get({
                param: { pitchId },
                query: {
                    type: options?.type as any,
                    bookingId: options?.bookingId,
                    payoutId: options?.payoutId,
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

export interface CreateLedgerPayload {
    amount: number;
    bookingId?: string;
    note: string;
}

interface CreateLedgerParams {
    pitchId: string;
    payload: CreateLedgerPayload;
}

export function useLedgerMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ pitchId, payload }: CreateLedgerParams) => {
            const res = await client.dashboard.pitches[":pitchId"].ledgers.$post({
                param: { pitchId },
                json: payload,
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data;
        },
        onSuccess: (_data, { pitchId }) => {
            queryClient.invalidateQueries({ queryKey: ["ledgers", "list", pitchId] });
            queryClient.invalidateQueries({ queryKey: ["ledgers", "infinite", pitchId] });
            queryClient.invalidateQueries({ queryKey: ["payouts", "list", pitchId] });
            queryClient.invalidateQueries({ queryKey: ["payouts", "infinite", pitchId] });
        },
    });
};
