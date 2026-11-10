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
