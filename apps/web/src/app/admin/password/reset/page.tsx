"use client";

import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { message, problemCode, send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { PageShell } from "@/admin/page-shell";

const MIN_PASSWORD = 8;

// Where a password reset link lands (ROUTES.adminPasswordReset), sent when another admin resets
// this one's password. Like the invitation page, the token is in the URL fragment, which browsers
// never send to a server, so it's read here and posted to the API. Setting the password signs the
// admin out everywhere; they then sign in with it.
export default function ResetAdminPassword() {
  // undefined while the fragment is read; "" when the link has none.
  const [token, setToken] = useState<string>();
  const [ended, setEnded] = useState(false);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // The token stays in the address bar so a refresh still works. It's single-use, so a copy left
  // in history is dead once it's used.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  }, []);

  const toSignIn = () => window.location.assign("/admin/login");

  if (token === undefined) return null;

  if (done) {
    return (
      <PageShell
        title="Your password is changed"
        subtitle="You’ve been signed out everywhere. Sign in with your new password."
      >
        <Button onClick={toSignIn}>Go to sign in</Button>
      </PageShell>
    );
  }

  if (!token) {
    return (
      <PageShell
        title="This link is incomplete"
        subtitle="The link you followed is missing some details. Please open it again from the email you received."
      >
        <Button variant="secondary" onClick={toSignIn}>
          Go to sign in
        </Button>
      </PageShell>
    );
  }

  if (ended) {
    return (
      <PageShell
        title="This link has ended"
        subtitle="It was already used, replaced by a newer one, or it’s more than a day old. Ask another admin to send a new one."
      >
        <Button variant="secondary" onClick={toSignIn}>
          Go to sign in
        </Button>
      </PageShell>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const result = await send(
      api.POST("/v1/auth/admin/password-reset", { body: { token, password } }),
    );
    setBusy(false);
    if (result.ok) setDone(true);
    else if (problemCode(result.error) === "PASSWORD_RESET_INVALID") setEnded(true);
    else setError(message(result.error));
  };

  return (
    <PageShell title="Choose a new password" subtitle="Another admin reset your password.">
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="New password"
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          autoFocus
          placeholder="Choose a password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(undefined);
          }}
          error={error}
          hint="At least 8 characters."
          trailing={
            <button
              type="button"
              aria-label={shown ? "Hide password" : "Show password"}
              onClick={() => setShown(!shown)}
              className="flex cursor-pointer text-unit hover:text-ink"
            >
              {/* As on sign in: the open eye while the password shows. */}
              {shown ? (
                <IconEye size={20} className="size-5 shrink-0" stroke={2} />
              ) : (
                <IconEyeOff size={20} className="size-5 shrink-0" stroke={2} />
              )}
            </button>
          }
        />
        <div className="mt-6">
          <Button type="submit" loading={busy} disabled={password.length < MIN_PASSWORD}>
            Change password
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
