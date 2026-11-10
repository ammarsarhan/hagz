"use client";

import type { AdminInvitation } from "@hagz/contracts";
import { IconMailForward, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/admin/button";
import { SidePanel } from "@/admin/side-panel";

// The invitations still open, in a side panel over the admins table: who each went to, who sent
// it and when it stops working, with Revoke on each. Invite admin sits in the footer, and both open
// their modal over the panel, which stays open behind it.

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "in 2 days", "in 5 hours", "in 20 minutes": when the link stops working.
export const expiresIn = (iso: string, now = Date.now()) => {
  const minutes = Math.max(1, Math.round((new Date(iso).getTime() - now) / 60_000));
  if (minutes >= 60 * 24) return relative.format(Math.round(minutes / (60 * 24)), "day");
  if (minutes >= 60) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(minutes, "minute");
};

export function InvitationsPanel({
  invitations,
  onInvite,
  onRevoke,
  onClose,
}: {
  invitations: AdminInvitation[];
  onInvite: () => void;
  onRevoke: (invitation: AdminInvitation) => void;
  onClose: () => void;
}) {
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);

  return (
    <SidePanel
      open={open}
      onRequestClose={hide}
      onExited={onClose}
      title={
        <>
          Invitations
          <span className="font-normal text-ink-3">{invitations.length}</span>
        </>
      }
      description="Links that haven't been used yet. Each works for 48 hours."
      footer={
        <Button size="small" onClick={onInvite}>
          <IconPlus size={16} className="size-4" stroke={2} />
          Invite admin
        </Button>
      }
    >
      {invitations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconMailForward size={28} className="size-7 text-ink-3" stroke={1.5} />
          <p className="text-label text-ink-2">No open invitations.</p>
        </div>
      ) : (
        <ul className="-mt-2">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex items-center justify-between gap-4 border-b border-border/75 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-label font-medium text-ink">{invitation.email}</p>
                <p className="mt-0.5 truncate text-caption text-ink-2">
                  From {invitation.invitedBy} · expires {expiresIn(invitation.expiresAt)}
                </p>
              </div>
              <Button variant="secondary" size="small" onClick={() => onRevoke(invitation)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
}
