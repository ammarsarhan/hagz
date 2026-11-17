"use client";

import type { PermissionArea, PermissionLevel, StaffPermissions } from "@hagz/contracts";
import type { components } from "@hagz/api";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's Team tab's data, with no design: its staff (the owner first) and the invitations still
// open, both fetched together when the tab opens.

export type VenueMember = components["schemas"]["VenueMember"];
export type StaffInvitation = components["schemas"]["StaffInvitation"];

interface Loaded {
  members: VenueMember[];
  invitations: StaffInvitation[];
}

export function useVenueTeam(venueId: string) {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const path = { params: { path: { id: venueId } } };
    const [members, invitations] = await Promise.all([
      send(api.GET("/v1/admin/venues/{id}/members", path)),
      send(api.GET("/v1/admin/venues/{id}/invitations", path)),
    ]);
    if (!members.ok || !invitations.ok) {
      // Either failing fails the tab; the first one's problem is what's shown.
      const failure = [members, invitations].find((result) => !result.ok);
      const problem = failure && !failure.ok ? failure.error : undefined;
      const text = message(problem);
      setError(text);
      if (notTheirFault(problem)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData({ members: members.data.data, invitations: invitations.data.data });
  }, [venueId, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, reload: () => void load() };
}

// The dashboard's areas in the order the staff app lists them, with what each covers.
export const AREAS: { area: PermissionArea; label: string }[] = [
  { area: "bookings", label: "Bookings" },
  { area: "customers", label: "Customers" },
  { area: "schedule", label: "Schedule" },
  { area: "payments", label: "Payments" },
  { area: "finance", label: "Finance" },
  { area: "staff", label: "Staff" },
  { area: "venue", label: "Venue" },
];

export const levelLabel: Record<PermissionLevel, string> = {
  none: "No access",
  view: "View",
  manage: "Manage",
};

// "Manages 2 · views 3", "Views 7", "No access": a member's permissions in a few words, for the table.
export const accessSummary = (permissions: StaffPermissions) => {
  const levels = AREAS.map(({ area }) => permissions[area]);
  const manage = levels.filter((level) => level === "manage").length;
  const view = levels.filter((level) => level === "view").length;
  if (manage === AREAS.length) return "Manages everything";
  const parts = [
    ...(manage ? [`manages ${String(manage)}`] : []),
    ...(view ? [`views ${String(view)}`] : []),
  ];
  if (parts.length === 0) return "No access";
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
