"use client";

import type { components } from "@hagz/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// The Support page's data, with no design: staff or customer accounts a page at a time from the API,
// which searches by name or phone, so the table never holds everyone at once.

export type StaffAccount = components["schemas"]["AdminStaffAccount"];
export type CustomerAccount = components["schemas"]["AdminCustomerAccount"];
export type AccountStatus = StaffAccount["status"];

type Kind = "staff" | "customers";
type AccountOf<K extends Kind> = K extends "staff" ? StaffAccount : CustomerAccount;

interface Loaded<T> {
  accounts: T[];
  nextCursor: string | null;
}

// How long typing pauses before the search goes to the API.
const SEARCH_DELAY_MS = 250;

export function useAccounts<K extends Kind>(kind: K, query: string) {
  const [data, setData] = useState<Loaded<AccountOf<K>>>();
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const hud = useHud();
  // Bumped by every new search, so an answer to an older one (slower to arrive) is dropped.
  const latest = useRef(0);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const params = { params: { query: { q: query.trim() || undefined, cursor } } };
      const result =
        kind === "staff"
          ? await send(api.GET("/v1/admin/staff", params))
          : await send(api.GET("/v1/admin/customers", params));
      return result as
        | { ok: true; data: { data: AccountOf<K>[]; nextCursor: string | null } }
        | { ok: false; error: unknown };
    },
    [kind, query],
  );

  const load = useCallback(async () => {
    const request = ++latest.current;
    const result = await fetchPage();
    if (request !== latest.current) return;
    if (!result.ok) {
      const text = message(result.error);
      setError(text);
      if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData({ accounts: result.data.data, nextCursor: result.data.nextCursor });
  }, [fetchPage, hud]);

  useEffect(() => {
    // A new search waits for typing to pause; opening the tab loads straight away.
    const timer = setTimeout(() => void load(), query ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const loadMore = async () => {
    if (!data?.nextCursor || loadingMore) return;
    const request = latest.current;
    setLoadingMore(true);
    const result = await fetchPage(data.nextCursor);
    setLoadingMore(false);
    if (request !== latest.current) return;
    if (!result.ok) {
      hud(
        message(result.error),
        notTheirFault(result.error)
          ? { label: "Try again", run: () => void loadMore() }
          : undefined,
      );
      return;
    }
    setData({
      accounts: [...data.accounts, ...result.data.data],
      nextCursor: result.data.nextCursor,
    });
  };

  // After suspending or reactivating: the row changes in place, so the pages already loaded stay.
  const setStatus = (id: string, status: AccountStatus) =>
    setData(
      (was) =>
        was && {
          ...was,
          accounts: was.accounts.map((account) =>
            account.id === id ? { ...account, status } : account,
          ),
        },
    );

  return { data, error, loadingMore, loadMore, setStatus };
}

export const statusLabel: Record<AccountStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
};

// "Owner of Champions Arena", "3 venues": a staff member's venues in a few words, for the table;
// null when they're on none.
export const venuesSummary = (venues: StaffAccount["venues"]) => {
  if (venues.length === 0) return null;
  const [first] = venues;
  if (venues.length === 1 && first) {
    return `${first.role === "OWNER" ? "Owner" : "Member"} of ${first.name ?? "an untitled venue"}`;
  }
  return `${String(venues.length)} venues`;
};
