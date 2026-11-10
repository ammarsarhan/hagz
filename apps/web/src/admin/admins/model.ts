"use client";

import type { AdminInvitation, AdminListEntry } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// The Admins page's data, with no design: every admin, and the invitations still open. Both are
// fetched together, and again after anything changes.

export interface Loaded {
  admins: AdminListEntry[];
  // Newest first, so one just sent is at the top.
  invitations: AdminInvitation[];
}

export function useAdmins() {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const [admins, invitations] = await Promise.all([
      send(api.GET("/v1/admin/list")),
      send(api.GET("/v1/admin/invitations")),
    ]);
    const failed = !admins.ok ? admins : !invitations.ok ? invitations : null;
    if (failed || !admins.ok || !invitations.ok) {
      // Shown where the table would be; when it isn't the admin's fault the HUD says so too.
      const text = message(failed?.error);
      setError(text);
      if (notTheirFault(failed?.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData({
      admins: admins.data.data,
      invitations: [...invitations.data.data].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    });
  }, [hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, reload: () => void load() };
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "in 2 days", "in 5 hours", "in 20 minutes": when an invitation's link stops working.
export const expiresIn = (iso: string, now = Date.now()) => {
  const minutes = Math.max(1, Math.round((new Date(iso).getTime() - now) / 60_000));
  if (minutes >= 60 * 24) return relative.format(Math.round(minutes / (60 * 24)), "day");
  if (minutes >= 60) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(minutes, "minute");
};

// "8 Nov 2026", in the admin's own time zone.
export const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
