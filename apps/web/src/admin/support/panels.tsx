"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { Tag } from "@/admin/data-table";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { ReasonDialog } from "@/admin/reason-dialog";
import { DetailRow, PanelSection, SidePanel } from "@/admin/side-panel";
import { dateTime } from "@/admin/venues/history";
import { venueHref } from "@/admin/venues/sections";
import { statusLabel, type AccountStatus, type CustomerAccount, type StaffAccount } from "./model";

// The Support page's side panels, opened by clicking a row: a staff member, with their venues,
// suspend, reactivate or ban, and a password reset for an owner; or a customer, with suspend or
// reactivate. Each action is kept with a reason on the account's record (and, for staff, on each of
// their venues' History). Closing slides the panel out first, and onClose (which removes it) runs
// once it's gone.

function Status({ status }: { status: AccountStatus }) {
  return <Tag tone={status === "ACTIVE" ? "on" : "neutral"}>{statusLabel[status]}</Tag>;
}

// What every account has: who it is, its state, when it joined and last signed in, and its id to
// look it up.
function AccountRows({ account }: { account: StaffAccount | CustomerAccount }) {
  return (
    <div>
      <DetailRow label="Name" value={account.name} />
      <DetailRow label="Phone" value={account.phone ?? <span className="text-ink-3">None</span>} />
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
  const [action, setAction] = useState<"suspend" | "reactivate" | "ban" | "reset">();
  const ownsAVenue = staff.venues.some((venue) => venue.role === "OWNER");
  // When a reset was allowed while the panel is open: the API doesn't say whether one is open, so
  // the panel says it until it closes.
  const [resetUntil, setResetUntil] = useState<Date>();
  const close = () => setAction(undefined);
  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title="Staff"
      description="Their account across every venue they're on, and keeping them out of it."
      compact
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
            <p className="text-label text-ink-2">This account was banned for good.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {staff.status === "SUSPENDED" ? (
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
              {/* Owners can't reset their password by themselves (a recycled number would take the
                  venue with it); members can, so it's only offered to an owner. */}
              {ownsAVenue && staff.status === "ACTIVE" && resetUntil ? (
                <p role="status" className="text-label text-ink-2">
                  Password reset allowed until {dateTime(resetUntil.toISOString())}. Tell them to
                  use Forgot password in the staff app.
                </p>
              ) : ownsAVenue && staff.status === "ACTIVE" ? (
                <AccessAction
                  title="Allow a password reset"
                  description="Once you've checked who they are: they can reset it once in the app, with a code to their phone, within 24 hours. They keep every venue and permission."
                  action="Allow"
                  onClick={() => setAction("reset")}
                />
              ) : null}
              {/* Not offered to an owner: the API refuses until their venue has another owner. */}
              {ownsAVenue ? null : (
                <AccessAction
                  title="Ban account"
                  description="For good: they can never sign in again. Use it for abuse or fraud, not a pause."
                  action="Ban"
                  onClick={() => setAction("ban")}
                />
              )}
            </div>
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
      {action === "ban" ? (
        <ReasonDialog
          title={`Ban ${staff.name}'s account for good?`}
          description="They're signed out everywhere now and can never sign in again. This can't be undone."
          confirmLabel="Ban"
          request={(reason) =>
            send(
              api.POST("/v1/admin/staff/{staffId}/ban", {
                params: { path: { staffId: staff.id } },
                body: { reason },
              }),
            )
          }
          onClose={close}
          onDone={() => onStatus("BANNED")}
        />
      ) : null}
      {action === "reset" ? (
        <ReasonDialog
          title={`Let ${staff.name} reset their password?`}
          description="Tell them to use Forgot password in the staff app within 24 hours. A code goes to their phone; nobody at Hagz sees the new password."
          confirmLabel="Allow reset"
          danger={false}
          hint="Kept on their account's record. Say how you checked who they are."
          placeholder="They called from their number and confirmed …"
          request={(reason) =>
            send(
              api.POST("/v1/admin/staff/{staffId}/password-reset", {
                params: { path: { staffId: staff.id } },
                body: { reason },
              }),
            )
          }
          onClose={close}
          onDone={() => setResetUntil(new Date(Date.now() + 24 * 60 * 60 * 1000))}
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

// A customer's account, and keeping them out of it. Customers can't be banned in v1, so a banned
// one (none yet) only says so.
export function CustomerAccountPanel({
  customer,
  onStatus,
  onClose,
}: {
  customer: CustomerAccount;
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
      title="Customer"
      description="A player's account, and keeping them out of it."
      compact
    >
      <div className="flex flex-col gap-6">
        <PanelSection title="Account">
          <AccountRows account={customer} />
        </PanelSection>

        <PanelSection title="Support">
          {customer.status === "BANNED" ? (
            <p className="text-label text-ink-2">This account was banned for good.</p>
          ) : customer.status === "SUSPENDED" ? (
            <AccessAction
              title="Reactivate account"
              description="They can sign in and book again."
              action="Reactivate"
              onClick={() => setAction("reactivate")}
            />
          ) : (
            <AccessAction
              title="Suspend account"
              description="Signs them out everywhere and keeps them out of the app until it's reactivated."
              action="Suspend"
              onClick={() => setAction("suspend")}
            />
          )}
        </PanelSection>
      </div>

      {action === "suspend" ? (
        <ReasonDialog
          title={`Suspend ${customer.name}'s account?`}
          description="They're signed out everywhere and can't sign in until you reactivate them. An app already open stops working within 10 minutes."
          confirmLabel="Suspend"
          hint="Kept on their account's record. Say what happened."
          placeholder="Reported by a venue for …"
          request={(reason) =>
            send(
              api.POST("/v1/admin/customers/{customerId}/suspend", {
                params: { path: { customerId: customer.id } },
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
          title={`Reactivate ${customer.name}'s account?`}
          description="They can sign in and book again."
          confirmLabel="Reactivate"
          danger={false}
          request={() =>
            send(
              api.POST("/v1/admin/customers/{customerId}/reactivate", {
                params: { path: { customerId: customer.id } },
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
