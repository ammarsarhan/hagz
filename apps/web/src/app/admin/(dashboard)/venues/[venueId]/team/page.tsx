"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { day, expiresIn } from "@/admin/admins/model";
import { Initial } from "@/admin/admins/panels";
import { DataTable, TableSearch, Tag } from "@/admin/data-table";
import { TabPanel, Tabs } from "@/admin/tabs";
import {
  accessSummary,
  useVenueTeam,
  type StaffInvitation,
  type VenueMember,
} from "@/admin/venues/team";
import { MemberPanel, TeamInvitationPanel } from "@/admin/venues/team-panels";

// A venue's Team tab, laid out like the Admins page: tabs on a hairline that split it into the staff
// (the owner first) and the invitations still open, each a table under its own search, numbered
// from 1. Clicking a row opens it in a side panel: a member's role and permissions, or an
// invitation's. Looking only; the venue's own staff manage their team in the dashboard app.

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
]);

const invitationWidths = { index: "3.5rem", invitedBy: "26%", sent: "16%", expires: "16%" };

// --- Page ---

// What the search matches: any of the texts, ignoring case.
const filter = <T,>(items: T[], query: string, texts: (item: T) => (string | null)[]) => {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => texts(item).some((text) => text?.toLowerCase().includes(q)));
};

type Section = "members" | "invitations";
type Selected = { kind: "member"; id: string } | { kind: "invitation"; id: string };

export default function VenueTeam() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error } = useVenueTeam(venueId);
  const [section, setSection] = useState<Section>("members");
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
      <Tabs
        label="Team sections"
        value={section}
        onChange={setSection}
        items={[
          { id: "members", label: "Members", count: data?.members.length },
          { id: "invitations", label: "Invitations", count: data?.invitations.length },
        ]}
      />

      {section === "members" ? (
        <TabPanel id="members">
          <div className="mt-6">
            <TableSearch
              value={memberQuery}
              onChange={setMemberQuery}
              placeholder="Search members…"
            />
          </div>
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
        </TabPanel>
      ) : (
        <TabPanel id="invitations">
          <div className="mt-6">
            <TableSearch
              value={invitationQuery}
              onChange={setInvitationQuery}
              placeholder="Search invitations…"
            />
          </div>
          <div className="mt-4">
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
          </div>
        </TabPanel>
      )}

      {selectedMember ? (
        <MemberPanel
          key={selectedMember.staffId}
          member={selectedMember}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
      {selectedInvitation ? (
        <TeamInvitationPanel
          key={selectedInvitation.id}
          invitation={selectedInvitation}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </>
  );
}
