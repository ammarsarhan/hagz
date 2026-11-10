"use client";

import { useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Read once: the fragment is cleared below, so a second run (React runs effects twice in
  // development) would find no token and show the link as ended.
  const read = useRef(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(value);
    // Out of the address bar, so it isn't left in history or shared by accident.
    if (value) window.history.replaceState(null, "", window.location.pathname);
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

  if (ended || !token) {
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
          type="password"
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
