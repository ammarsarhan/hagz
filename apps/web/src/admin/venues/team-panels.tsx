"use client";

import type { StaffPermissions } from "@hagz/contracts";
import { useState } from "react";
import { expiresIn } from "@/admin/admins/model";
import { Avatar } from "@/admin/avatar";
import { Tag } from "@/admin/data-table";
import { DetailRow, PanelSection, SidePanel } from "@/admin/side-panel";
import { dateTime } from "./history";
import { AREAS, levelLabel, type StaffInvitation, type VenueMember } from "./team";

// A venue's Team tab's side panels, opened by clicking a row: a member, or an open invitation. For
// looking only: the venue's own staff manage their team in the dashboard app. Closing slides the
// panel out first, and onClose (which removes it) runs once it's gone.

export function MemberPanel({ member, onClose }: { member: VenueMember; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const owner = member.role === "OWNER";
  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={member.name}
      description={member.phone ?? "No phone number"}
    >
      <div className="flex flex-col gap-6">
        {/* Their initials, as on the Account page: staff accounts have no photo yet. */}
        <Avatar name={member.name} size="large" />
        <PanelSection title="Member">
          <div>
            <DetailRow label="Role" value={owner ? <Tag>Owner</Tag> : "Member"} />
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
      </div>
    </SidePanel>
  );
}

// An invitation still open: who it's for, who sent it, when it stops working, and what they'll be
// able to do once they join.
export function TeamInvitationPanel({
  invitation,
  onClose,
}: {
  invitation: StaffInvitation;
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
