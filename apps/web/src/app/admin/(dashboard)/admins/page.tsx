"use client";

import type { AdminListEntry } from "@hagz/contracts";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  globalFilteringFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { createContext, useContext, useState } from "react";
import { useAdmins } from "@/admin/admins/model";
import { DataTable, TableSearch, Tag } from "@/admin/data-table";
import { PageHeader } from "@/admin/page-header";
import { useAdmin } from "@/admin/session";

// Admins, in the Platform pages' table (the user's references, Mobbin's Skills list and Attio's
// Members): everyone who can sign in here, searchable by name or email.

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
});
const helper = createColumnHelper<typeof features, AdminListEntry>();

// "8 Nov 2026", in the admin's own time zone.
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const statusTag: Record<AdminListEntry["status"], { label: string; on: boolean }> = {
  ACTIVE: { label: "Active", on: true },
  SUSPENDED: { label: "Suspended", on: false },
  BANNED: { label: "Banned", on: false },
};

// Columns are module-level (TanStack needs them stable), so the signed-in admin reaches the name
// cell through context instead of a closure.
const SelfContext = createContext<string | null>(null);

function Name({ admin }: { admin: AdminListEntry }) {
  const self = useContext(SelfContext);
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip text-caption font-semibold text-ink-2"
      >
        {admin.name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="truncate font-medium">{admin.name}</span>
      {admin.id === self ? <Tag>You</Tag> : null}
    </div>
  );
}

const columns = helper.columns([
  helper.accessor((admin) => admin.name, {
    id: "name",
    header: "Name",
    cell: ({ row }) => <Name admin={row.original} />,
  }),
  helper.display({
    id: "email",
    header: "Email",
    cell: ({ row }) => <span className="truncate text-ink-2">{row.original.email}</span>,
  }),
  helper.display({
    id: "authenticator",
    header: "Authenticator",
    cell: ({ row }) =>
      row.original.authenticatorSetUp ? (
        <span className="text-ink-2">Set up</span>
      ) : (
        <span className="text-ink-3">Not yet</span>
      ),
  }),
  helper.display({
    id: "lastSignIn",
    header: "Last signed in",
    cell: ({ row }) =>
      row.original.lastSignedInAt ? (
        <span className="text-ink-2">{day(row.original.lastSignedInAt)}</span>
      ) : (
        <span className="text-ink-3">Never</span>
      ),
  }),
  helper.display({
    id: "added",
    header: "Added",
    cell: ({ row }) => <span className="text-ink-2">{day(row.original.createdAt)}</span>,
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { label, on } = statusTag[row.original.status];
      return <Tag tone={on ? "on" : "neutral"}>{label}</Tag>;
    },
  }),
]);

const widths = {
  email: "26%",
  authenticator: "12%",
  lastSignIn: "13%",
  added: "11%",
  status: "10%",
};

// Matches the name or the email.
const matches = (admin: AdminListEntry, query: string) => {
  const q = query.trim().toLowerCase();
  return [admin.name, admin.email].some((text) => text.toLowerCase().includes(q));
};

export default function Admins() {
  const self = useAdmin();
  const { data, error } = useAdmins();
  const [query, setQuery] = useState("");

  const table = useTable({
    features,
    columns,
    data: data?.admins ?? [],
    getRowId: (admin) => admin.id,
    state: { globalFilter: query },
    onGlobalFilterChange: setQuery,
    // One search over the whole row, run once per row from the name column.
    getColumnCanGlobalFilter: (column) => column.id === "name",
    globalFilterFn: (row, _columnId, value: string) => matches(row.original, value),
  });

  return (
    <>
      <PageHeader title="Admins" subtitle="The people who can sign in here." />

      <div className="mt-8 flex items-center gap-2">
        <TableSearch value={query} onChange={setQuery} placeholder="Search admins…" />
      </div>

      <div className="mt-4">
        <SelfContext.Provider value={self.id}>
          <DataTable
            table={table}
            widths={widths}
            loading={!data && !error}
            empty={error ?? (query ? `No admin matches “${query}”.` : "No admins yet.")}
          />
        </SelfContext.Provider>
      </div>
    </>
  );
}
