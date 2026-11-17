"use client";

import { IconTrash } from "@tabler/icons-react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { day, expiresIn } from "@/admin/admins/model";
import { Initial } from "@/admin/admins/panels";
import { DataTable, RowMenu, TableSearch, Tag } from "@/admin/data-table";
import { Section } from "@/admin/section";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import {
  accessSummary,
  useVenueTeam,
  type StaffInvitation,
  type VenueMember,
} from "@/admin/venues/team";
import { MemberPanel, TeamInvitationPanel } from "@/admin/venues/team-panels";

// A venue's Team tab, laid out like the Account page: the staff (the owner first) on top, then the
// invitations still open below a hairline, each a titled section with its own search over a table
// in the Admins page's design, numbered from 1. Members come first: fewer, and what an admin looks
// for. Clicking a row opens it in a side panel: a member's role and permissions with what support
// can do for them, or an invitation's with Revoke (also in its row's ⋯).

// Each row's place in the table as it's shown (after the search), counting from 1.
const indexColumn = {
  id: "index",
  header: "#",
  cell: ({ row }: { row: { index: number } }) => (
    <span className="text-ink-3 tabular-nums">{row.index + 1}</span>
  ),
};

// --- Members ---

const memberFeatures = tableFeatures({});
const memberHelper = createColumnHelper<typeof memberFeatures, VenueMember>();

const memberColumns = memberHelper.columns([
  memberHelper.display(indexColumn),
  memberHelper.display({
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Initial name={row.original.name} />
        <span className="truncate text-ink">{row.original.name}</span>
        {row.original.role === "OWNER" ? <Tag>Owner</Tag> : null}
        {row.original.status === "ACTIVE" ? null : (
          <Tag>{row.original.status === "SUSPENDED" ? "Suspended" : "Banned"}</Tag>
        )}
      </div>
    ),
  }),
  memberHelper.display({
    id: "phone",
    header: "Phone",
    cell: ({ row }) =>
      row.original.phone ? (
        <span className="text-ink-2 tabular-nums">{row.original.phone}</span>
      ) : (
        <span className="text-ink-3">None</span>
      ),
  }),
  memberHelper.display({
    id: "access",
    header: "Access",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="truncate text-ink-2">
          {row.original.role === "OWNER" ? "Everything" : accessSummary(row.original.permissions)}
        </span>
        {row.original.restorable ? <Tag>Read-only after reset</Tag> : null}
      </div>
    ),
  }),
]);

const memberWidths = { index: "3.5rem", phone: "22%", access: "34%" };

// --- Invitations ---

const invitationFeatures = tableFeatures({});
const invitationHelper = createColumnHelper<typeof invitationFeatures, StaffInvitation>();

// Columns are module-level (TanStack needs them stable), so the page's revoke reaches the row menu
// through context instead of a closure.
const RevokeContext = createContext<((invitation: StaffInvitation) => void) | null>(null);

function InvitationMenu({ invitation }: { invitation: StaffInvitation }) {
  const revoke = useContext(RevokeContext);
  if (!revoke) return null;
  return (
    <RowMenu
      label={`Actions for the invitation to ${invitation.phone}`}
      items={[
        { label: "Revoke", icon: IconTrash, tone: "danger", onSelect: () => revoke(invitation) },
      ]}
    />
  );
}

const invitationColumns = invitationHelper.columns([
  invitationHelper.display(indexColumn),
  invitationHelper.display({
    id: "phone",
    header: "Phone",
    cell: ({ row }) => <span className="text-ink tabular-nums">{row.original.phone}</span>,
  }),
  invitationHelper.display({
    id: "invitedBy",
    header: "Invited by",
    cell: ({ row }) => <span className="truncate text-ink-2">{row.original.invitedBy}</span>,
  }),
  invitationHelper.display({
    id: "sent",
    header: "Sent",
    cell: ({ row }) => <span className="text-ink-2">{day(row.original.createdAt)}</span>,
  }),
  invitationHelper.display({
    id: "expires",
    header: "Expires",
    cell: ({ row }) => <span className="text-ink-2">{expiresIn(row.original.expiresAt)}</span>,
  }),
  invitationHelper.display({
    id: "menu",
    header: "",
    cell: ({ row }) => <InvitationMenu invitation={row.original} />,
  }),
]);

const invitationWidths = {
  index: "3.5rem",
  invitedBy: "26%",
  sent: "16%",
  expires: "16%",
  menu: "3.5rem",
};

// --- Page ---

// What the search matches: any of the texts, ignoring case.
const filter = <T,>(items: T[], query: string, texts: (item: T) => (string | null)[]) => {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => texts(item).some((text) => text?.toLowerCase().includes(q)));
};

type Selected = { kind: "member"; id: string } | { kind: "invitation"; id: string };

export default function VenueTeam() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error, reload } = useVenueTeam(venueId);
  // The invitation being revoked, asked first.
  const [revoking, setRevoking] = useState<StaffInvitation>();
  const [memberQuery, setMemberQuery] = useState("");
  const [invitationQuery, setInvitationQuery] = useState("");
  const [selected, setSelected] = useState<Selected>();

  const selectedMember =
    selected?.kind === "member"
      ? data?.members.find((member) => member.staffId === selected.id)
      : undefined;
  const selectedInvitation =
    selected?.kind === "invitation"
      ? data?.invitations.find((invitation) => invitation.id === selected.id)
      : undefined;

  const members = useMemo(
    () => filter(data?.members ?? [], memberQuery, (member) => [member.name, member.phone]),
    [data, memberQuery],
  );
  const invitations = useMemo(
    () =>
      filter(data?.invitations ?? [], invitationQuery, (invitation) => [
        invitation.phone,
        invitation.invitedBy,
      ]),
    [data, invitationQuery],
  );

  const memberTable = useTable({
    features: memberFeatures,
    columns: memberColumns,
    data: members,
    getRowId: (member) => member.staffId,
  });
  const invitationTable = useTable({
    features: invitationFeatures,
    columns: invitationColumns,
    data: invitations,
    getRowId: (invitation) => invitation.id,
  });

  return (
    <>
      <Section title="Members" description="Who works at the venue, the owner first.">
        <TableSearch value={memberQuery} onChange={setMemberQuery} placeholder="Search members…" />
        <div className="mt-4">
          <DataTable
            table={memberTable}
            widths={memberWidths}
            onRowClick={(row) => setSelected({ kind: "member", id: row.original.staffId })}
            loading={!data && !error}
            empty={
              error ??
              (memberQuery.trim() ? `No member matches “${memberQuery}”.` : "No members yet.")
            }
          />
        </div>
      </Section>

      <Section
        title="Invitations"
        description="Sent by the venue's staff and waiting for an answer."
      >
        <TableSearch
          value={invitationQuery}
          onChange={setInvitationQuery}
          placeholder="Search invitations…"
        />
        <div className="mt-4">
          <RevokeContext.Provider value={setRevoking}>
            <DataTable
              table={invitationTable}
              widths={invitationWidths}
              onRowClick={(row) => setSelected({ kind: "invitation", id: row.original.id })}
              loading={!data && !error}
              empty={
                error ??
                (invitationQuery.trim()
                  ? `No invitation matches “${invitationQuery}”.`
                  : "No open invitations.")
              }
            />
          </RevokeContext.Provider>
        </div>
      </Section>

      {selectedMember ? (
        <MemberPanel
          key={selectedMember.staffId}
          venueId={venueId}
          member={selectedMember}
          onChanged={reload}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
      {selectedInvitation ? (
        <TeamInvitationPanel
          key={selectedInvitation.id}
          invitation={selectedInvitation}
          onRevoke={() => setRevoking(selectedInvitation)}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
      {revoking ? (
        <ConfirmDialog
          title={`Revoke the invitation to ${revoking.phone}?`}
          description="Its code stops working. The venue can invite them again later."
          confirmLabel="Revoke"
          request={() =>
            send(
              api.DELETE("/v1/admin/venues/{id}/invitations/{invitationId}", {
                params: { path: { id: venueId, invitationId: revoking.id } },
              }),
            )
          }
          onClose={() => setRevoking(undefined)}
          onDone={reload}
        />
      ) : null}
    </>
  );
}
