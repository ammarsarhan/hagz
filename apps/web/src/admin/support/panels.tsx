"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { Avatar } from "@/admin/avatar";
import { Tag } from "@/admin/data-table";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { ReasonDialog } from "@/admin/reason-dialog";
import { DetailRow, PanelSection, SidePanel } from "@/admin/side-panel";
import { dateTime } from "@/admin/venues/history";
import { venueHref } from "@/admin/venues/sections";
import { statusLabel, type AccountStatus, type CustomerAccount, type StaffAccount } from "./model";

// The Support page's side panels, opened by clicking a row: a staff member, with their venues and
// suspend or reactivate; or a customer. Closing slides the panel out first, and onClose (which
// removes it) runs once it's gone.

function Status({ status }: { status: AccountStatus }) {
  return <Tag tone={status === "ACTIVE" ? "on" : "neutral"}>{statusLabel[status]}</Tag>;
}

// What every account has: its state, when it joined and last signed in, and its id to look it up.
function AccountRows({ account }: { account: StaffAccount | CustomerAccount }) {
  return (
    <div>
      <DetailRow label="Status" value={<Status status={account.status} />} />
      <DetailRow label="Joined" value={dateTime(account.createdAt)} />
      <DetailRow
        label="Last signed in"
        value={
          account.lastSignedInAt ? (
            dateTime(account.lastSignedInAt)
          ) : (
            <span className="text-ink-3">Never</span>
          )
        }
      />
      <DetailRow
        label="ID"
        value={<span className="select-all font-mono text-caption">{account.id}</span>}
      />
    </div>
  );
}

export function StaffAccountPanel({
  staff,
  onStatus,
  onClose,
}: {
  staff: StaffAccount;
  // After suspending or reactivating, so the table shows it.
  onStatus: (status: AccountStatus) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [action, setAction] = useState<"suspend" | "reactivate">();
  const close = () => setAction(undefined);
  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={staff.name}
      description={staff.phone ?? "No phone number"}
      media={<Avatar name={staff.name} size="large" />}
    >
      <div className="flex flex-col gap-6">
        <PanelSection title="Account">
          <AccountRows account={staff} />
        </PanelSection>

        <PanelSection title="Venues">
          {staff.venues.length === 0 ? (
            <p className="text-label text-ink-3">Not on any venue's staff.</p>
          ) : (
            <ul>
              {staff.venues.map((venue) => (
                <li
                  key={venue.id}
                  className="flex items-center justify-between gap-4 border-b border-border/75 py-2.5 last:border-b-0"
                >
                  <Link
                    href={venueHref(venue.id, "team")}
                    className="truncate text-label text-ink underline-offset-2 hover:underline"
                  >
                    {venue.name ?? "Untitled venue"}
                  </Link>
                  {venue.role === "OWNER" ? (
                    <Tag>Owner</Tag>
                  ) : (
                    <span className="text-caption text-ink-2">Member</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection title="Support">
          {staff.status === "BANNED" ? (
            <p className="text-label text-ink-2">This account was closed for good.</p>
          ) : staff.status === "SUSPENDED" ? (
            <AccessAction
              title="Reactivate account"
              description="They can sign in again, to every venue they're on."
              action="Reactivate"
              onClick={() => setAction("reactivate")}
            />
          ) : (
            <AccessAction
              title="Suspend account"
              description="Signs them out everywhere and keeps them out of every venue they're on until it's reactivated."
              action="Suspend"
              onClick={() => setAction("suspend")}
            />
          )}
        </PanelSection>
      </div>

      {action === "suspend" ? (
        <ReasonDialog
          title={`Suspend ${staff.name}'s account?`}
          description="They're signed out everywhere now and can't use any venue until you reactivate them."
          confirmLabel="Suspend"
          request={(reason) =>
            send(
              api.POST("/v1/admin/staff/{staffId}/suspend", {
                params: { path: { staffId: staff.id } },
                body: { reason },
              }),
            )
          }
          onClose={close}
          onDone={() => onStatus("SUSPENDED")}
        />
      ) : null}
      {action === "reactivate" ? (
        <ConfirmDialog
          title={`Reactivate ${staff.name}'s account?`}
          description="They can sign in again, to every venue they're on."
          confirmLabel="Reactivate"
          danger={false}
          request={() =>
            send(
              api.POST("/v1/admin/staff/{staffId}/reactivate", {
                params: { path: { staffId: staff.id } },
              }),
            )
          }
          onClose={close}
          onDone={() => onStatus("ACTIVE")}
        />
      ) : null}
    </SidePanel>
  );
}

// A customer's account, for looking up. Suspending customers isn't in the API yet.
export function CustomerAccountPanel({
  customer,
  onClose,
}: {
  customer: CustomerAccount;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={customer.name}
      description={customer.phone ?? "No phone number"}
      media={<Avatar name={customer.name} size="large" />}
    >
      <PanelSection title="Account">
        <AccountRows account={customer} />
      </PanelSection>
    </SidePanel>
  );
}
