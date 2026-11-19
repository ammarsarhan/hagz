"use client";

import type { StaffPermissions } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { expiresIn } from "@/admin/admins/model";
import { AccessAction } from "@/admin/admins/panels";
import { Button } from "@/admin/button";
import { ConfirmDialog } from "@/admin/dialog";
import { Tag } from "@/admin/data-table";
import { send } from "@/admin/errors";
import { DetailRow, PanelSection, SidePanel } from "@/admin/side-panel";
import { dateTime } from "./history";
import { ReasonDialog } from "@/admin/reason-dialog";
import { OwnerResetAction } from "@/admin/support/owner-reset";
import { AREAS, levelLabel, type StaffInvitation, type VenueMember } from "./team";

// A venue's Team tab's side panels, opened by clicking a row: a member, or an open invitation. The
// venue's own staff run their team in the dashboard app; what's here is support for when they
// can't. Closing slides the panel out first, and onClose (which removes it) runs once it's gone.

type MemberAction = "owner" | "remove" | "suspend" | "reactivate" | "ban";

// A member with what support can do for them, each asked first in a modal over the panel: make them
// the owner, take them off the staff (never the owner), let the owner reset their password once
// support has checked who they are, suspend their account everywhere (or reactivate it), or ban it
// for good (not while they own a venue; the API checks their others). Everything but reactivating
// asks for a reason, kept on the venue's History (a reset on their account's record).
export function MemberPanel({
  venueId,
  member,
  onChanged,
  onClose,
}: {
  venueId: string;
  member: VenueMember;
  // After an action, so the team catches up (a removed member's panel then goes with their row).
  onChanged: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [action, setAction] = useState<MemberAction>();
  const close = () => setAction(undefined);
  const owner = member.role === "OWNER";
  const suspended = member.status === "SUSPENDED";
  const banned = member.status === "BANNED";
  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title="Member"
      description="Their place on this venue's staff, what they can do, and support for them."
      compact
    >
      <div className="flex flex-col gap-6">
        <PanelSection title="Member">
          <div>
            <DetailRow label="Name" value={member.name} />
            <DetailRow
              label="Phone"
              value={member.phone ?? <span className="text-ink-3">None</span>}
            />
            <DetailRow label="Role" value={owner ? <Tag>Owner</Tag> : "Member"} />
            <DetailRow
              label="Account"
              value={
                member.status === "ACTIVE" ? (
                  "Active"
                ) : (
                  <Tag>{suspended ? "Suspended" : "Banned"}</Tag>
                )
              }
            />
            <DetailRow
              label="Staff ID"
              value={<span className="select-all font-mono text-caption">{member.staffId}</span>}
            />
          </div>
        </PanelSection>

        <PanelSection title="Permissions">
          {owner ? (
            <p className="text-label text-ink-2">The owner can do everything.</p>
          ) : (
            <>
              {member.restorable ? (
                <p className="text-label text-ink-2">
                  Read-only since a password reset. The venue can give back what they had.
                </p>
              ) : null}
              <Permissions permissions={member.permissions} />
            </>
          )}
        </PanelSection>

        <PanelSection title="Support">
          <div className="flex flex-col gap-6">
            {owner ? null : (
              <>
                <AccessAction
                  title="Make owner"
                  description="Only once you've checked who they are: the owner controls payouts. The current owner stays on and can still manage everything."
                  action="Make owner"
                  onClick={() => setAction("owner")}
                />
                <AccessAction
                  title="Remove from venue"
                  description="Takes them off the staff. Their account, and their name on what they did here, stay."
                  action="Remove"
                  onClick={() => setAction("remove")}
                />
              </>
            )}
            {banned ? (
              <p className="text-label text-ink-2">Their account was banned for good.</p>
            ) : (
              <>
                {suspended ? (
                  <AccessAction
                    title="Reactivate account"
                    description="They can sign in again, to every venue they're on."
                    action="Reactivate"
                    onClick={() => setAction("reactivate")}
                  />
                ) : (
                  <>
                    {/* The owner can't reset their password by themselves; members can. */}
                    {owner ? (
                      <OwnerResetAction staffId={member.staffId} name={member.name} />
                    ) : null}
                    <AccessAction
                      title="Suspend account"
                      description="Signs them out everywhere and keeps them out of every venue they're on until it's reactivated."
                      action="Suspend"
                      onClick={() => setAction("suspend")}
                    />
                  </>
                )}
                {/* Not offered to the owner: the API refuses until the venue has another owner. */}
                {owner ? null : (
                  <AccessAction
                    title="Ban account"
                    description="For good: they can never sign in again. Use it for abuse or fraud, not a pause."
                    action="Ban"
                    onClick={() => setAction("ban")}
                  />
                )}
              </>
            )}
          </div>
        </PanelSection>
      </div>

      {action === "owner" ? (
        <ReasonDialog
          title={`Make ${member.name} the owner?`}
          description="They control the venue and its payouts from now on. Both of them are told."
          confirmLabel="Make owner"
          danger={false}
          request={(reason) =>
            send(
              api.POST("/v1/admin/venues/{id}/owner", {
                params: { path: { id: venueId } },
                body: { staffId: member.staffId, reason },
              }),
            )
          }
          onClose={close}
          onDone={onChanged}
        />
      ) : null}
      {action === "remove" ? (
        <ReasonDialog
          title={`Remove ${member.name} from the venue?`}
          description="They lose access to it at once and are told. They can be invited again later."
          confirmLabel="Remove"
          request={(reason) =>
            send(
              api.POST("/v1/admin/venues/{id}/members/{staffId}/remove", {
                params: { path: { id: venueId, staffId: member.staffId } },
                body: { reason },
              }),
            )
          }
          onClose={close}
          onDone={onChanged}
        />
      ) : null}
      {action === "suspend" ? (
        <ReasonDialog
          title={`Suspend ${member.name}'s account?`}
          description="They're signed out everywhere now and can't use any venue until you reactivate them."
          confirmLabel="Suspend"
          request={(reason) =>
            send(
              api.POST("/v1/admin/staff/{staffId}/suspend", {
                params: { path: { staffId: member.staffId } },
                body: { reason },
              }),
            )
          }
          onClose={close}
          onDone={onChanged}
        />
      ) : null}
      {action === "ban" ? (
        <ReasonDialog
          title={`Ban ${member.name}'s account for good?`}
          description="They're signed out everywhere now and can never sign in again. This can't be undone."
          confirmLabel="Ban"
          request={(reason) =>
            send(
              api.POST("/v1/admin/staff/{staffId}/ban", {
                params: { path: { staffId: member.staffId } },
                body: { reason },
              }),
            )
          }
          onClose={close}
          onDone={onChanged}
        />
      ) : null}
      {action === "reactivate" ? (
        <ConfirmDialog
          title={`Reactivate ${member.name}'s account?`}
          description="They can sign in again, to every venue they're on."
          confirmLabel="Reactivate"
          danger={false}
          request={() =>
            send(
              api.POST("/v1/admin/staff/{staffId}/reactivate", {
                params: { path: { staffId: member.staffId } },
              }),
            )
          }
          onClose={close}
          onDone={onChanged}
        />
      ) : null}
    </SidePanel>
  );
}

// An invitation still open: who it's for, who sent it, when it stops working, and what they'll be
// able to do once they join. Revoke stops its code working.
export function TeamInvitationPanel({
  invitation,
  onRevoke,
  onClose,
}: {
  invitation: StaffInvitation;
  // Asks first, over the panel.
  onRevoke: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={invitation.phone}
      description={`Invited by ${invitation.invitedBy}`}
      footer={
        <Button variant="secondary" size="small" onClick={onRevoke}>
          Revoke
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <PanelSection title="Invitation">
          <div>
            <DetailRow label="Sent" value={dateTime(invitation.createdAt)} />
            <DetailRow
              label="Expires"
              value={`${expiresIn(invitation.expiresAt)} · ${dateTime(invitation.expiresAt)}`}
            />
          </div>
        </PanelSection>
        <PanelSection title="Permissions">
          <Permissions permissions={invitation.permissions} />
        </PanelSection>
      </div>
    </SidePanel>
  );
}

// Each area of the dashboard and how far they can go in it.
function Permissions({ permissions }: { permissions: StaffPermissions }) {
  return (
    <div>
      {AREAS.map(({ area, label }) => {
        const level = permissions[area];
        return (
          <DetailRow
            key={area}
            label={label}
            value={
              level === "none" ? (
                <span className="text-ink-3">{levelLabel.none}</span>
              ) : (
                levelLabel[level]
              )
            }
          />
        );
      })}
    </div>
  );
}
