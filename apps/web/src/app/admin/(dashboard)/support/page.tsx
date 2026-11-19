"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useState } from "react";
import { day } from "@/admin/admins/model";
import { Initial } from "@/admin/admins/panels";
import { Button } from "@/admin/button";
import { DataTable, TableSearch, Tag } from "@/admin/data-table";
import { PageHeader } from "@/admin/page-header";
import {
  statusLabel,
  useAccounts,
  venuesSummary,
  type AccountStatus,
  type CustomerAccount,
  type StaffAccount,
} from "@/admin/support/model";
import { CustomerAccountPanel, StaffAccountPanel } from "@/admin/support/panels";
import { TabPanel, Tabs } from "@/admin/tabs";

// Support: finding a staff member or a customer to help them with their account. Two tabs, each the
// admin's one table under a search that goes to the API (name, or phone typed any way), a page at a
// time with Show more below. Clicking a row opens the account in a side panel: a staff member's
// venues, suspending or reactivating them and an owner's password reset, or a customer's details and
// suspending or reactivating them.

// Each row's place in the table as it's shown, counting from 1.
const indexColumn = {
  id: "index",
  header: "#",
  cell: ({ row }: { row: { index: number } }) => (
    <span className="text-ink-3 tabular-nums">{row.index + 1}</span>
  ),
};

function Name({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3">
      <Initial name={name} />
      <span className="truncate text-ink">{name}</span>
    </div>
  );
}

function Phone({ phone }: { phone: string | null }) {
  return phone ? (
    <span className="text-ink-2 tabular-nums">{phone}</span>
  ) : (
    <span className="text-ink-3">None</span>
  );
}

function LastSignedIn({ at }: { at: string | null }) {
  return at ? (
    <span className="text-ink-2">{day(at)}</span>
  ) : (
    <span className="text-ink-3">Never</span>
  );
}

function Status({ status }: { status: AccountStatus }) {
  return <Tag tone={status === "ACTIVE" ? "on" : "neutral"}>{statusLabel[status]}</Tag>;
}

// --- Staff ---

const staffFeatures = tableFeatures({});
const staffHelper = createColumnHelper<typeof staffFeatures, StaffAccount>();

const staffColumns = staffHelper.columns([
  staffHelper.display(indexColumn),
  staffHelper.display({
    id: "name",
    header: "Name",
    cell: ({ row }) => <Name name={row.original.name} />,
  }),
  staffHelper.display({
    id: "phone",
    header: "Phone",
    cell: ({ row }) => <Phone phone={row.original.phone} />,
  }),
  staffHelper.display({
    id: "venues",
    header: "Venues",
    cell: ({ row }) => {
      const summary = venuesSummary(row.original.venues);
      return summary ? (
        <span className="truncate text-ink-2">{summary}</span>
      ) : (
        <span className="text-ink-3">None</span>
      );
    },
  }),
  staffHelper.display({
    id: "lastSignIn",
    header: "Last signed in",
    cell: ({ row }) => <LastSignedIn at={row.original.lastSignedInAt} />,
  }),
  staffHelper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => <Status status={row.original.status} />,
  }),
]);

const staffWidths = {
  index: "3.5rem",
  phone: "16%",
  venues: "24%",
  lastSignIn: "12%",
  status: "9rem",
};

// --- Customers ---

const customerFeatures = tableFeatures({});
const customerHelper = createColumnHelper<typeof customerFeatures, CustomerAccount>();

const customerColumns = customerHelper.columns([
  customerHelper.display(indexColumn),
  customerHelper.display({
    id: "name",
    header: "Name",
    cell: ({ row }) => <Name name={row.original.name} />,
  }),
  customerHelper.display({
    id: "phone",
    header: "Phone",
    cell: ({ row }) => <Phone phone={row.original.phone} />,
  }),
  customerHelper.display({
    id: "joined",
    header: "Joined",
    cell: ({ row }) => <span className="text-ink-2">{day(row.original.createdAt)}</span>,
  }),
  customerHelper.display({
    id: "lastSignIn",
    header: "Last signed in",
    cell: ({ row }) => <LastSignedIn at={row.original.lastSignedInAt} />,
  }),
  customerHelper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => <Status status={row.original.status} />,
  }),
]);

const customerWidths = {
  index: "3.5rem",
  phone: "18%",
  joined: "12%",
  lastSignIn: "12%",
  status: "9rem",
};

// --- Page ---

type Section = "staff" | "customers";

export default function AdminSupport() {
  const [section, setSection] = useState<Section>("staff");
  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Find venue staff and customers to help them with their accounts."
      />
      <div className="mt-6">
        <Tabs
          label="Accounts"
          value={section}
          onChange={setSection}
          items={[
            { id: "staff", label: "Staff" },
            { id: "customers", label: "Customers" },
          ]}
        />
      </div>
      {/* One tab at a time, each with its own search and pages. */}
      {section === "staff" ? (
        <TabPanel id="staff">
          <StaffTab />
        </TabPanel>
      ) : (
        <TabPanel id="customers">
          <CustomersTab />
        </TabPanel>
      )}
    </>
  );
}

function StaffTab() {
  const [query, setQuery] = useState("");
  const { data, error, loadingMore, loadMore, setStatus } = useAccounts("staff", query);
  const [selected, setSelected] = useState<string>();
  const table = useTable({
    features: staffFeatures,
    columns: staffColumns,
    data: data?.accounts ?? [],
    getRowId: (staff) => staff.id,
  });
  // Looked up in the latest data, so the panel shows a suspension straight away.
  const open = data?.accounts.find((staff) => staff.id === selected);

  return (
    <>
      <div className="mt-6">
        <TableSearch value={query} onChange={setQuery} placeholder="Search by name or phone…" />
      </div>
      <div className="mt-4">
        <DataTable
          table={table}
          widths={staffWidths}
          onRowClick={(row) => setSelected(row.original.id)}
          loading={!data && !error}
          empty={error ?? (query.trim() ? `No staff match “${query.trim()}”.` : "No staff yet.")}
        />
      </div>
      <ShowMore next={data?.nextCursor} loading={loadingMore} onClick={loadMore} />
      {open ? (
        <StaffAccountPanel
          key={open.id}
          staff={open}
          onStatus={(status) => setStatus(open.id, status)}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </>
  );
}

function CustomersTab() {
  const [query, setQuery] = useState("");
  const { data, error, loadingMore, loadMore, setStatus } = useAccounts("customers", query);
  const [selected, setSelected] = useState<string>();
  const table = useTable({
    features: customerFeatures,
    columns: customerColumns,
    data: data?.accounts ?? [],
    getRowId: (customer) => customer.id,
  });
  const open = data?.accounts.find((customer) => customer.id === selected);

  return (
    <>
      <div className="mt-6">
        <TableSearch value={query} onChange={setQuery} placeholder="Search by name or phone…" />
      </div>
      <div className="mt-4">
        <DataTable
          table={table}
          widths={customerWidths}
          onRowClick={(row) => setSelected(row.original.id)}
          loading={!data && !error}
          empty={
            error ?? (query.trim() ? `No customer matches “${query.trim()}”.` : "No customers yet.")
          }
        />
      </div>
      <ShowMore next={data?.nextCursor} loading={loadingMore} onClick={loadMore} />
      {open ? (
        <CustomerAccountPanel
          key={open.id}
          customer={open}
          onStatus={(status) => setStatus(open.id, status)}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </>
  );
}

function ShowMore({
  next,
  loading,
  onClick,
}: {
  next: string | null | undefined;
  loading: boolean;
  onClick: () => Promise<void>;
}) {
  if (!next) return null;
  return (
    <div className="mt-6 flex justify-center">
      <Button size="small" variant="secondary" loading={loading} onClick={() => void onClick()}>
        Show more
      </Button>
    </div>
  );
}
