"use client";

import type { AdminInvitation, AdminListEntry } from "@hagz/contracts";
import { IconArrowRight, IconPlus, IconTrash } from "@tabler/icons-react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { createContext, useContext, useMemo, useState } from "react";
import { api } from "@/admin/api";
import { InviteDialog } from "@/admin/admins/invite-dialog";
import { day, expiresIn, useAdmins } from "@/admin/admins/model";
import { AdminPanel, AdminStatus, Initial, InvitationPanel } from "@/admin/admins/panels";
import { Button } from "@/admin/button";
import { DataTable, RowMenu, TableSearch, Tag } from "@/admin/data-table";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { PageHeader } from "@/admin/page-header";
import { useAdmin } from "@/admin/session";
import { TabPanel, Tabs } from "@/admin/tabs";

// Admins, laid out like a marketplace's page: tabs on a hairline that split it into the admins and
// the invitations still open, each a table in the Platform pages' design (the user's references,
// Mobbin's Skills list and Attio's Members) under its own search, numbered from 1. Invite admin sits
// on the Invitations tab, next to its search, and opens the add flows' modal, as on Platform.
// Clicking a row opens it in a side panel: an admin's details, or an invitation's with Resend and
// Revoke.

// Columns are module-level (TanStack needs them stable), so the signed-in admin and the page's
// actions reach the cells through context instead of a closure.
const RowContext = createContext<{
  self: string;
  open: (invitation: AdminInvitation) => void;
  revoke: (invitation: AdminInvitation) => void;
} | null>(null);

// Each row's place in the table as it's shown (after the search), counting from 1.
const indexColumn = {
  id: "index",
  header: "#",
  cell: ({ row }: { row: { index: number } }) => (
    <span className="text-ink-3 tabular-nums">{row.index + 1}</span>
  ),
};

// --- Admins ---

const adminFeatures = tableFeatures({});
const adminHelper = createColumnHelper<typeof adminFeatures, AdminListEntry>();

function AdminName({ admin }: { admin: AdminListEntry }) {
  const context = useContext(RowContext);
  return (
    <div className="flex items-center gap-3">
      <Initial name={admin.name} />
      <span className="truncate text-ink">{admin.name}</span>
      {admin.id === context?.self ? <Tag>You</Tag> : null}
    </div>
  );
}

const adminColumns = adminHelper.columns([
  adminHelper.display(indexColumn),
  adminHelper.accessor((admin) => admin.name, {
    id: "name",
    header: "Name",
    cell: ({ row }) => <AdminName admin={row.original} />,
  }),
  adminHelper.display({
    id: "email",
    header: "Email",
    cell: ({ row }) => <span className="truncate text-ink-2">{row.original.email}</span>,
  }),
  adminHelper.display({
    id: "authenticator",
    header: "Authenticator",
    cell: ({ row }) =>
      row.original.authenticatorSetUp ? (
        <span className="text-ink-2">Set up</span>
      ) : (
        <span className="text-ink-3">Not yet</span>
      ),
  }),
  adminHelper.display({
    id: "lastSignIn",
    header: "Last signed in",
    cell: ({ row }) =>
      row.original.lastSignedInAt ? (
        <span className="text-ink-2">{day(row.original.lastSignedInAt)}</span>
      ) : (
        <span className="text-ink-3">Never</span>
      ),
  }),
  adminHelper.display({
    id: "added",
    header: "Added",
    cell: ({ row }) => <span className="text-ink-2">{day(row.original.createdAt)}</span>,
  }),
  adminHelper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => <AdminStatus status={row.original.status} />,
  }),
]);

const adminWidths = {
  index: "3.5rem",
  email: "26%",
  authenticator: "12%",
  lastSignIn: "13%",
  added: "11%",
  status: "10%",
};

// --- Invitations ---

const invitationFeatures = tableFeatures({});
const invitationHelper = createColumnHelper<typeof invitationFeatures, AdminInvitation>();

function InvitationMenu({ invitation }: { invitation: AdminInvitation }) {
  const context = useContext(RowContext);
  if (!context) return null;
  return (
    <RowMenu
      label={`Actions for the invitation to ${invitation.email}`}
      items={[
        { label: "Open", icon: IconArrowRight, onSelect: () => context.open(invitation) },
        {
          label: "Revoke",
          icon: IconTrash,
          tone: "danger",
          onSelect: () => context.revoke(invitation),
        },
      ]}
    />
  );
}

const invitationColumns = invitationHelper.columns([
  invitationHelper.display(indexColumn),
  invitationHelper.accessor((invitation) => invitation.email, {
    id: "email",
    header: "Email",
    cell: ({ row }) => <span className="truncate text-ink">{row.original.email}</span>,
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
  invitedBy: "24%",
  sent: "14%",
  expires: "14%",
  menu: "3.5rem",
};

// --- Page ---

// What the search matches: any of the texts, ignoring case.
const filter = <T,>(items: T[], query: string, texts: (item: T) => string[]) => {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => texts(item).some((text) => text.toLowerCase().includes(q)));
};

type Section = "admins" | "invitations";

type Modal = { form: "invite" } | { form: "revoke"; invitation: AdminInvitation };

// The row open in a side panel. An invitation is followed by its email, which stays the same when
// it's resent (the API replaces it with a new one).
type Selected = { kind: "admin"; id: string } | { kind: "invitation"; email: string };

export default function Admins() {
  const self = useAdmin();
  const { data, error, reload } = useAdmins();
  const [section, setSection] = useState<Section>("admins");
  const [adminQuery, setAdminQuery] = useState("");
  const [invitationQuery, setInvitationQuery] = useState("");
  const [modal, setModal] = useState<Modal>();
  const close = () => setModal(undefined);
  const [selected, setSelected] = useState<Selected>();
  const openInvitation = (invitation: AdminInvitation) =>
    setSelected({ kind: "invitation", email: invitation.email });
  const revoke = (invitation: AdminInvitation) => setModal({ form: "revoke", invitation });

  // Looked up in the latest data, so a panel shows changes, and goes once its row is gone.
  const selectedAdmin =
    selected?.kind === "admin" ? data?.admins.find((admin) => admin.id === selected.id) : undefined;
  const selectedInvitation =
    selected?.kind === "invitation"
      ? data?.invitations.find((invitation) => invitation.email === selected.email)
      : undefined;

  const admins = useMemo(
    () => filter(data?.admins ?? [], adminQuery, (admin) => [admin.name, admin.email]),
    [data, adminQuery],
  );
  const invitations = useMemo(
    () =>
      filter(data?.invitations ?? [], invitationQuery, (invitation) => [
        invitation.email,
        invitation.invitedBy,
      ]),
    [data, invitationQuery],
  );

  const adminTable = useTable({
    features: adminFeatures,
    columns: adminColumns,
    data: admins,
    getRowId: (admin) => admin.id,
  });
  const invitationTable = useTable({
    features: invitationFeatures,
    columns: invitationColumns,
    data: invitations,
    getRowId: (invitation) => invitation.id,
  });

  return (
    <>
      <PageHeader
        title="Admins"
        subtitle="The people who can sign in here, and the invitations still open."
      />

      <div className="mt-6">
        <Tabs
          label="Sections"
          value={section}
          onChange={setSection}
          items={[
            { id: "admins", label: "Admins", count: data?.admins.length },
            { id: "invitations", label: "Invitations", count: data?.invitations.length },
          ]}
        />
      </div>

      <RowContext.Provider value={{ self: self.id, open: openInvitation, revoke }}>
        {section === "admins" ? (
          <TabPanel id="admins">
            <div className="mt-6">
              <TableSearch
                value={adminQuery}
                onChange={setAdminQuery}
                placeholder="Search admins…"
              />
            </div>
            <div className="mt-4">
              <DataTable
                table={adminTable}
                widths={adminWidths}
                onRowClick={(row) => setSelected({ kind: "admin", id: row.original.id })}
                loading={!data && !error}
                empty={
                  error ??
                  (adminQuery.trim() ? `No admin matches “${adminQuery}”.` : "No admins yet.")
                }
              />
            </div>
          </TabPanel>
        ) : (
          <TabPanel id="invitations">
            <div className="mt-6 flex items-center justify-between gap-2">
              <TableSearch
                value={invitationQuery}
                onChange={setInvitationQuery}
                placeholder="Search invitations…"
              />
              <Button size="small" onClick={() => setModal({ form: "invite" })} disabled={!data}>
                <IconPlus size={16} className="size-4" stroke={2} />
                Invite admin
              </Button>
            </div>
            <div className="mt-4">
              <DataTable
                table={invitationTable}
                widths={invitationWidths}
                onRowClick={(row) => openInvitation(row.original)}
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
      </RowContext.Provider>

      {selectedAdmin ? (
        <AdminPanel
          key={selectedAdmin.id}
          admin={selectedAdmin}
          self={selectedAdmin.id === self.id}
          onChanged={reload}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
      {selectedInvitation ? (
        <InvitationPanel
          key={selectedInvitation.email}
          invitation={selectedInvitation}
          onRevoke={() => revoke(selectedInvitation)}
          onResent={reload}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
      {modal?.form === "invite" ? <InviteDialog onClose={close} onDone={reload} /> : null}
      {modal?.form === "revoke" ? (
        <ConfirmDialog
          title={`Revoke the invitation to ${modal.invitation.email}?`}
          description="Its link stops working. You can invite them again later."
          confirmLabel="Revoke"
          request={() =>
            send(
              api.DELETE("/v1/admin/invitations/{id}", {
                params: { path: { id: modal.invitation.id } },
              }),
            )
          }
          onClose={close}
          onDone={reload}
        />
      ) : null}
    </>
  );
}
