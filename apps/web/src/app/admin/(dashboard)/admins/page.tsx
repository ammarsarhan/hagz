"use client";

import { IconPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Dialog } from "@/admin/dialog";
import { message, problemCode, send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { PageHeader } from "@/admin/page-header";
import { useAdmin } from "@/admin/session";
import { fromNow } from "@/admin/time";

interface AdminRow {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  authenticatorSetUp: boolean;
  lastSignedInAt: string | null;
}

interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

const pill = {
  neutral: "bg-chip text-ink-2",
  red: "bg-red/10 text-red",
} as const;

function Pill({ tone = "neutral", children }: { tone?: keyof typeof pill; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-caption font-medium ${pill[tone]}`}>
      {children}
    </span>
  );
}

// A white card holding a table: a grey header row, hairlines between rows.
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-hud border border-border bg-white">
      <table className="w-full text-left">
        <thead className="bg-field">
          <tr>
            {head.map((label, i) => (
              <th
                key={label || i}
                className="px-5 py-3 text-caption font-medium text-ink-2 last:text-right"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-5 [&_td]:py-4 [&_td]:text-body [&_td]:text-ink-2 [&_td:last-child]:text-right [&_tr]:border-t [&_tr]:border-border">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export default function Admins() {
  const me = useAdmin();
  const [admins, setAdmins] = useState<AdminRow[]>();
  const [invitations, setInvitations] = useState<Invitation[]>();
  const [loadError, setLoadError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<Invitation>();

  const load = useCallback(async () => {
    const [list, open] = await Promise.all([
      send(api.GET("/v1/admin/list")),
      send(api.GET("/v1/admin/invitations")),
    ]);
    if (!list.ok) {
      setLoadError(message(list.error));
      return;
    }
    if (!open.ok) {
      setLoadError(message(open.error));
      return;
    }
    setLoadError(undefined);
    setAdmins(list.data.data);
    setInvitations(open.data.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Admins"
        subtitle="Everyone here has full access to Hagz Admin."
        actions={
          <div className="w-44">
            <Button onClick={() => setInviting(true)}>
              <span className="flex items-center gap-2">
                <IconPlus size={18} stroke={2.25} />
                Invite admin
              </span>
            </Button>
          </div>
        }
      />
      {loadError ? (
        <p className="mt-8 rounded-field bg-red/10 px-4 py-3 text-label text-red">{loadError}</p>
      ) : null}
      {admins ? (
        <section className="mt-8">
          <Table head={["Name", "Email", "Authenticator", "Last signed in", ""]}>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {admin.name}
                    {admin.id === me.id ? <Pill>You</Pill> : null}
                    {admin.status !== "ACTIVE" ? (
                      <Pill tone="red">{admin.status === "BANNED" ? "Banned" : "Suspended"}</Pill>
                    ) : null}
                  </span>
                </td>
                <td>{admin.email}</td>
                <td>{admin.authenticatorSetUp ? "Set up" : <Pill>Setup not finished</Pill>}</td>
                <td>{admin.lastSignedInAt ? fromNow(admin.lastSignedInAt) : "Never"}</td>
                <td />
              </tr>
            ))}
          </Table>
        </section>
      ) : null}
      {invitations ? (
        <section className="mt-12">
          <h2 className="flex items-center gap-2.5 text-[18px] leading-6 font-semibold text-ink">
            Invitations
            <Pill>{invitations.length}</Pill>
          </h2>
          <div className="mt-4">
            {invitations.length === 0 ? (
              <p className="rounded-hud border border-dashed border-border px-5 py-8 text-center text-label text-ink-2">
                No open invitations. Invite someone and their link shows here until it’s used or
                expires.
              </p>
            ) : (
              <Table head={["Email", "Invited by", "Expires", "Sent", ""]}>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="font-medium text-ink">{invitation.email}</td>
                    <td>{invitation.invitedBy}</td>
                    <td>{fromNow(invitation.expiresAt)}</td>
                    <td>{fromNow(invitation.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setRevoking(invitation)}
                        className="cursor-pointer text-label font-medium text-ink hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </section>
      ) : null}
      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onSent={() => {
          setInviting(false);
          void load();
        }}
      />
      <RevokeDialog
        invitation={revoking}
        onClose={() => setRevoking(undefined)}
        onRevoked={() => {
          setRevoking(undefined);
          void load();
        }}
      />
    </>
  );
}

function InviteDialog({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setError(undefined);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    const result = await send(api.POST("/v1/admin/invitations", { body: { email: email.trim() } }));
    setBusy(false);
    if (result.ok) {
      onSent();
      return;
    }
    const code = problemCode(result.error);
    if (code === "ADMIN_ALREADY_EXISTS") setError("That email is already an admin.");
    else if (code === "VALIDATION_FAILED") setError("Enter a valid email address.");
    else setError(message(result.error));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite an admin"
      subtitle="They’ll get an email with a link to create their account. It works for 48 hours."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Email"
          type="email"
          autoFocus
          placeholder="name@hagz.app"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(undefined);
          }}
          error={error}
          hint="Every admin has full access, including inviting other admins."
        />
        <div className="mt-7 flex gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!email.trim()}>
            Send invitation
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RevokeDialog({
  invitation,
  onClose,
  onRevoked,
}: {
  invitation?: Invitation;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const revoke = async () => {
    if (!invitation) return;
    setBusy(true);
    const result = await send(
      api.DELETE("/v1/admin/invitations/{id}", { params: { path: { id: invitation.id } } }),
    );
    setBusy(false);
    if (result.ok) onRevoked();
    else setError(message(result.error));
  };
  return (
    <Dialog
      open={Boolean(invitation)}
      onClose={() => {
        setError(undefined);
        onClose();
      }}
      title="Revoke this invitation?"
      subtitle={
        invitation ? `The link sent to ${invitation.email} stops working at once.` : undefined
      }
    >
      {error ? <p className="mb-4 text-label font-medium text-red">{error}</p> : null}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button loading={busy} onClick={() => void revoke()}>
          Revoke
        </Button>
      </div>
    </Dialog>
  );
}
