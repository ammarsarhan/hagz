"use client";

import { IconEye, IconEyeOff, IconMail } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { message, notTheirFault, problemCode, send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { useHud } from "@/admin/hud";
import { PageHeader } from "@/admin/page-header";
import { signOut, useAdmin, useUpdateAdmin } from "@/admin/session";

// The signed-in admin's own account, after the user's reference (2026-11-11, an Account settings
// page): Save changes in the header, then rows split by hairlines, each with its label and a line on
// the left and its fields on the right. The name and the password change here; the email is the
// sign-in and stays as invited. Signing out lives here too.

const MIN_PASSWORD = 8;
// How long Save changes says "Saved" after it worked.
const SAVED_MS = 2_000;

function Row({
  label,
  description,
  required = false,
  children,
}: {
  label: string;
  description: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-3 border-t border-border py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <div>
        <p className="text-label font-medium text-ink">
          {label}
          {required ? <span className="ml-0.5 text-red">*</span> : null}
        </p>
        <p className="mt-1 max-w-[26rem] text-label text-ink-2">{description}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

// The eye at the end of a password field, as on sign in: the open eye while the password shows.
function Reveal({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={shown ? "Hide password" : "Show password"}
      onClick={onToggle}
      className="flex cursor-pointer text-unit hover:text-ink"
    >
      {shown ? (
        <IconEye size={20} className="size-5 shrink-0" stroke={2} />
      ) : (
        <IconEyeOff size={20} className="size-5 shrink-0" stroke={2} />
      )}
    </button>
  );
}

export default function Account() {
  const admin = useAdmin();
  const updateAdmin = useUpdateAdmin();
  const hud = useHud();
  const [name, setName] = useState(admin.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [shown, setShown] = useState({ current: false, next: false });
  const [wrongPassword, setWrongPassword] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const renaming = name.trim() !== admin.name;
  const changingPassword = current !== "" || next !== "";
  const valid =
    name.trim() !== "" && (!changingPassword || (current !== "" && next.length >= MIN_PASSWORD));

  const save = async () => {
    setBusy(true);
    setWrongPassword(undefined);
    // One at a time, so a refused password doesn't leave the name half-saved behind a vague error.
    if (renaming) {
      const result = await send(api.PATCH("/v1/auth/admin/me", { body: { name: name.trim() } }));
      if (!result.ok) {
        setBusy(false);
        return hud(message(result.error), retry(result.error));
      }
      updateAdmin(result.data);
      setName(result.data.name);
    }
    if (changingPassword) {
      const result = await send(
        api.POST("/v1/auth/admin/me/password", {
          body: { currentPassword: current, newPassword: next },
        }),
      );
      if (!result.ok) {
        setBusy(false);
        if (problemCode(result.error) === "WRONG_PASSWORD") {
          return setWrongPassword(message(result.error));
        }
        return hud(message(result.error), retry(result.error));
      }
      setCurrent("");
      setNext("");
      setShown({ current: false, next: false });
    }
    setBusy(false);
    setSaved(true);
  };

  // Only failures that aren't the admin's fault are worth trying again as they are.
  const retry = (error: unknown) =>
    notTheirFault(error) ? { label: "Try again", run: () => void save() } : undefined;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && (renaming || changingPassword) && !busy) void save();
      }}
    >
      <PageHeader
        title="Account"
        subtitle="View and update your account details."
        actions={
          <Button
            type="submit"
            size="small"
            loading={busy}
            disabled={!valid || !(renaming || changingPassword)}
          >
            {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      <div className="mt-8 border-b border-border">
        <Row
          label="Name"
          required
          description="How other admins see you, in the admin list and on invitations you send."
        >
          <Field
            label="Name"
            hideLabel
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={name.trim() === "" ? "Your name can't be empty." : undefined}
          />
        </Row>

        <Row
          label="Email address"
          description="Used to sign in. It stays the address you were invited at."
        >
          <Field
            label="Email address"
            hideLabel
            type="email"
            value={admin.email}
            disabled
            readOnly
            leading={
              <IconMail size={18} className="size-[1.125rem] shrink-0 text-ink-2" stroke={1.75} />
            }
          />
        </Row>

        <Row
          label="Password"
          description={`Confirm your current password before setting a new one. ${MIN_PASSWORD} characters minimum. Your other browsers are signed out.`}
        >
          <Field
            label="Current password"
            hideLabel
            type={shown.current ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Current password"
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              setWrongPassword(undefined);
            }}
            error={wrongPassword}
            trailing={
              <Reveal
                shown={shown.current}
                onToggle={() => setShown((was) => ({ ...was, current: !was.current }))}
              />
            }
          />
          <Field
            label="New password"
            hideLabel
            type={shown.next ? "text" : "password"}
            autoComplete="new-password"
            placeholder="New password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            hint={
              next !== "" && next.length < MIN_PASSWORD
                ? `At least ${MIN_PASSWORD} characters.`
                : undefined
            }
            trailing={
              <Reveal
                shown={shown.next}
                onToggle={() => setShown((was) => ({ ...was, next: !was.next }))}
              />
            }
          />
        </Row>

        <Row label="Sign out" description="Sign out of the admin on this browser.">
          <div>
            <Button
              type="button"
              size="small"
              variant="secondary"
              loading={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </Row>
      </div>
    </form>
  );
}
