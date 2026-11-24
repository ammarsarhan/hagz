"use client";

import type { components } from "@hagz/api";
import type { AdminPayment } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A booking's Payments and History tabs' data, with no design.

export type BookingHistoryEvent = components["schemas"]["BookingHistoryEvent"];

export function useBookingHistory(bookingId: string) {
  const [data, setData] = useState<{ events: BookingHistoryEvent[]; next: string | null }>();
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const hud = useHud();

  const fetchPage = useCallback(
    (cursor?: string) =>
      send(
        api.GET("/v1/admin/bookings/{id}/history", {
          params: { path: { id: bookingId }, query: { cursor } },
        }),
      ),
    [bookingId],
  );

  const load = useCallback(async () => {
    const result = await fetchPage();
    if (!result.ok) {
      const text = message(result.error);
      setError(text);
      if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData({ events: result.data.data, next: result.data.nextCursor });
  }, [fetchPage, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!data?.next || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchPage(data.next);
    setLoadingMore(false);
    if (!result.ok) {
      hud(
        message(result.error),
        notTheirFault(result.error)
          ? { label: "Try again", run: () => void loadMore() }
          : undefined,
      );
      return;
    }
    setData({ events: [...data.events, ...result.data.data], next: result.data.nextCursor });
  };

  return { data, error, loadingMore, loadMore };
}

export function useBookingPayments(bookingId: string) {
  const [payments, setPayments] = useState<AdminPayment[]>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/bookings/{id}/payments", { params: { path: { id: bookingId } } }),
    );
    if (!result.ok) {
      const text = message(result.error);
      setError(text);
      if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setPayments(result.data.data);
  }, [bookingId, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return { payments, error };
}

// What each event is called in the table. Types are strings in the API, so an unknown one still
// reads as words: "SOMETHING_NEW" becomes "Something new".
const labels: Record<string, string> = {
  CREATED: "Booked",
  CONFIRMED: "Confirmed",
  EXPIRED: "Expired",
};

export const eventLabel = (type: string) =>
  labels[type] ?? type.charAt(0) + type.slice(1).toLowerCase().replaceAll("_", " ");
