"use client";

import type { AdminInvitation, AdminListEntry } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Tag } from "@/admin/data-table";
import { send } from "@/admin/errors";
import { DetailRow, PanelSection, SidePanel } from "@/admin/side-panel";
import { useSubmit } from "@/admin/submit";
import { day, expiresIn } from "./model";

// The Admins page's side panels, opened by clicking a row: an admin's details, or an invitation's
// with Resend and Revoke. Like Platform's edit panels, closing slides the panel out first and
// onClose (which removes it) runs once it's gone.

const statusTag: Record<AdminListEntry["status"], { label: string; on: boolean }> = {
  ACTIVE: { label: "Active", on: true },
  SUSPENDED: { label: "Suspended", on: false },
  BANNED: { label: "Banned", on: false },
};

export function AdminStatus({ status }: { status: AdminListEntry["status"] }) {
  const { label, on } = statusTag[status];
  return <Tag tone={on ? "on" : "neutral"}>{label}</Tag>;
}

// The first letter of a name in a grey circle, standing in for a photo.
export function Initial({ name, size = "small" }: { name: string; size?: "small" | "large" }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-chip font-semibold text-ink-2 ${
        size === "large" ? "size-8 text-label" : "size-7 text-caption"
      }`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

// "8 Nov 2026, 14:05", for when exactly something happened.
const moment = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// An admin, to look at: the API has no way to change one yet, so there's nothing to save.
export function AdminPanel({
  admin,
  self,
  onClose,
}: {
  admin: AdminListEntry;
  // Whether it's the signed-in admin.
  self: boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={
        <>
          <Initial name={admin.name} size="large" />
          {admin.name}
          {self ? <Tag>You</Tag> : null}
        </>
      }
      description={admin.email}
    >
      <div className="flex flex-col gap-6">
        <PanelSection title="Account">
          <div>
            <DetailRow label="Status" value={<AdminStatus status={admin.status} />} />
            <DetailRow label="Added" value={day(admin.createdAt)} />
          </div>
        </PanelSection>
        <PanelSection title="Sign-in">
          <div>
            <DetailRow
              label="Authenticator"
              value={
                admin.authenticatorSetUp ? "Set up" : <span className="text-ink-3">Not yet</span>
              }
            />
            <DetailRow
              label="Last signed in"
              value={
                admin.lastSignedInAt ? (
                  moment(admin.lastSignedInAt)
                ) : (
                  <span className="text-ink-3">Never</span>
                )
              }
            />
          </div>
        </PanelSection>
      </div>
    </SidePanel>
  );
}

// An invitation: who it's for, who sent it and when it stops working. Resend emails a fresh link
// that works for another 48 hours (the API replaces the open one); Revoke asks first, over the panel.
export function InvitationPanel({
  invitation,
  onRevoke,
  onResent,
  onClose,
}: {
  invitation: AdminInvitation;
  onRevoke: () => void;
  onResent: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  // Resending keeps the panel open: it updates in place with the new dates.
  const { busy, run } = useSubmit(onResent, () => {});

  const resend = () =>
    void run(() => send(api.POST("/v1/admin/invitations", { body: { email: invitation.email } })));

  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={invitation.email}
      description={`Invited by ${invitation.invitedBy}`}
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onRevoke} disabled={busy}>
            Revoke
          </Button>
          <Button size="small" onClick={resend} loading={busy}>
            Resend
          </Button>
        </>
      }
    >
      <PanelSection title="Invitation">
        <div>
          <DetailRow label="Sent" value={moment(invitation.createdAt)} />
          <DetailRow
            label="Expires"
            value={`${expiresIn(invitation.expiresAt)} · ${moment(invitation.expiresAt)}`}
          />
        </div>
      </PanelSection>
    </SidePanel>
  );
}
