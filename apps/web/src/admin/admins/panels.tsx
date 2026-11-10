"use client";

import type { AdminInvitation, AdminListEntry } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Skeleton, Tag } from "@/admin/data-table";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { DetailRow, PanelSection, SidePanel } from "@/admin/side-panel";
import { useSubmit } from "@/admin/submit";
import { ago, day, device, expiresIn, useAdminDetails } from "./model";

// The Admins page's side panels, opened by clicking a row: an admin's details with password and
// authenticator resets, or an invitation's with Resend and Revoke. Like Platform's edit panels, closing slides the panel out first and
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
export function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip text-caption font-semibold text-ink-2"
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

// An admin in full, with their access looked after here. The header is their name over their
// email; the body is what the API knows about them (how they joined, the authenticator, where
// they're signed in), then Access: reset their password (an emailed link) or their authenticator,
// each confirmed first in a modal over the panel. Neither is offered on your own account. The body
// scrolls when it's taller than the window.
export function AdminPanel({
  admin,
  self,
  onChanged,
  onClose,
}: {
  // From the list, so the name shows at once while the rest loads.
  admin: AdminListEntry;
  // Whether it's the signed-in admin.
  self: boolean;
  // After a reset, so the list catches up (the authenticator column).
  onChanged: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [confirm, setConfirm] = useState<"password" | "authenticator">();
  const { details, reload } = useAdminDetails(admin.id);
  const changed = () => {
    reload();
    onChanged();
  };

  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={admin.name}
      description={admin.email}
    >
      {details ? (
        <div className="flex flex-col gap-6">
          <PanelSection title="Account">
            <div>
              <DetailRow label="Status" value={<AdminStatus status={details.status} />} />
              <DetailRow label="Admin since" value={day(details.createdAt)} />
              <DetailRow
                label="Invited by"
                value={details.invitedBy ?? <span className="text-ink-3">By seed</span>}
              />
              <DetailRow
                label="Invitations sent"
                value={details.invitesSent.toLocaleString("en")}
              />
            </div>
          </PanelSection>

          <PanelSection title="Sign-in">
            <div>
              <DetailRow
                label="Authenticator"
                value={
                  details.authenticatorSetUpAt ? (
                    `Set up ${day(details.authenticatorSetUpAt)}`
                  ) : (
                    <span className="text-ink-3">Not set up yet</span>
                  )
                }
              />
              <DetailRow
                label="Last signed in"
                value={
                  details.lastSignedInAt ? (
                    moment(details.lastSignedInAt)
                  ) : (
                    <span className="text-ink-3">Never</span>
                  )
                }
              />
            </div>
          </PanelSection>

          <PanelSection title="Signed in on">
            {details.devices.length === 0 ? (
              <p className="text-label text-ink-3">Not signed in anywhere right now.</p>
            ) : (
              <ul>
                {details.devices.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-4 border-b border-border/75 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-label font-medium text-ink">
                        {device(session.userAgent)}
                        {session.current ? <Tag>This browser</Tag> : null}
                      </p>
                      <p className="mt-0.5 truncate text-caption text-ink-2">
                        {session.ipAddress ?? "Unknown address"} · signed in{" "}
                        {day(session.signedInAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-caption text-ink-2">
                      Active {ago(session.lastActiveAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>

          <PanelSection title="Access">
            {self ? (
              <p className="text-label text-ink-2">
                To reset your own password or authenticator, ask another admin.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <AccessAction
                  title="Reset password"
                  description="Emails them a link to choose a new one. Their current password works until they do."
                  action="Send link"
                  onClick={() => setConfirm("password")}
                />
                <AccessAction
                  title="Reset authenticator"
                  description="Signs them out everywhere. They set up a new one at their next sign-in."
                  action="Reset"
                  onClick={() => setConfirm("authenticator")}
                />
              </div>
            )}
          </PanelSection>
        </div>
      ) : (
        <DetailsLoading />
      )}

      {confirm === "password" ? (
        <ConfirmDialog
          title={`Send ${admin.name} a password reset link?`}
          description={`It goes to ${admin.email} and works for 24 hours. Once they choose a new password, they're signed out everywhere.`}
          confirmLabel="Send link"
          danger={false}
          request={() =>
            send(
              api.POST("/v1/admin/list/{id}/password-reset", {
                params: { path: { id: admin.id } },
              }),
            )
          }
          onClose={() => setConfirm(undefined)}
          onDone={changed}
        />
      ) : null}
      {confirm === "authenticator" ? (
        <ConfirmDialog
          title={`Reset ${admin.name}'s authenticator?`}
          description="They're signed out everywhere now, and set up a new authenticator the next time they sign in."
          confirmLabel="Reset"
          request={() =>
            send(
              api.DELETE("/v1/admin/list/{id}/authenticator", {
                params: { path: { id: admin.id } },
              }),
            )
          }
          onClose={() => setConfirm(undefined)}
          onDone={changed}
        />
      ) : null}
    </SidePanel>
  );
}

// One thing that can be done to an admin's access: what it is and does, and its button.
function AccessAction({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-12">
      <div className="min-w-0">
        <p className="text-label font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-caption text-ink-2">{description}</p>
      </div>
      <Button variant="secondary" size="small" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

// Grey bars where the sections will be, while the admin loads.
function DetailsLoading() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      {["w-1/3", "w-3/4", "w-2/3", "w-1/2", "w-3/5", "w-2/5"].map((width) => (
        <Skeleton key={width} className={`h-3.5 ${width}`} />
      ))}
    </div>
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
