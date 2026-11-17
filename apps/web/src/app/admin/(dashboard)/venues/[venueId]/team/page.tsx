"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { day, expiresIn } from "@/admin/admins/model";
import { Initial } from "@/admin/admins/panels";
import { DataTable, TableSearch, Tag } from "@/admin/data-table";
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
// for. Clicking a row opens it in a side panel: a member's role and permissions, or an
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

type Selected = { kind: "member"; id: string } | { kind: "invitation"; id: string };

export default function VenueTeam() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error } = useVenueTeam(venueId);
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
      <Section
        title="Members"
        description="Who works at the venue, the owner first."
        search={
          <TableSearch
            value={memberQuery}
            onChange={setMemberQuery}
            placeholder="Search members…"
          />
        }
      >
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
      </Section>

      <Section
        title="Invitations"
        description="Sent by the venue's staff and waiting for an answer."
        search={
          <TableSearch
            value={invitationQuery}
            onChange={setInvitationQuery}
            placeholder="Search invitations…"
          />
        }
      >
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
      </Section>

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

// A titled block, as on the Account page: the title, a line under it, then its search and table.
// The second sits below a hairline.
function Section({
  title,
  description,
  search,
  children,
}: {
  title: string;
  description: string;
  search: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0 [&+&]:mt-8">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-label text-ink-2">{description}</p>
      <div className="mt-5">{search}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
