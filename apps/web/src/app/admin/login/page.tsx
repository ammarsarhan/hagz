"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { Authenticator, type Challenge } from "@/admin/authenticator";
import { Button } from "@/admin/button";
import { message, problemCode, send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { PageShell } from "@/admin/page-shell";

// Figma "Sign in" (A1): email and password, then the authenticator (setup the first time).
export default function AdminLogin() {
  const [challenge, setChallenge] = useState<Challenge>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Already signed in (another tab, or back from the dashboard): straight in.
  useEffect(() => {
    void send(api.GET("/v1/auth/admin/me")).then((result) => {
      if (result.ok) window.location.replace("/admin");
    });
  }, []);

  const restart = useCallback((why: string) => {
    setChallenge(undefined);
    setPassword("");
    setNotice(why || undefined);
  }, []);

  if (challenge) {
    return <Authenticator challenge={challenge} email={email} onRestart={restart} />;
  }

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const result = await send(
      api.POST("/v1/auth/admin/sessions", { body: { email: email.trim(), password } }),
    );
    setBusy(false);
    if (result.ok) {
      setChallenge(result.data);
      return;
    }
    if (problemCode(result.error) === "INVALID_CREDENTIALS") setPassword("");
    setError(message(result.error));
  };

  return (
    <PageShell title="Sign in" subtitle="Enter the email and password for your admin account.">
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {notice ? (
          <p className="mb-6 rounded-field bg-field px-4 py-3 text-label text-ink">{notice}</p>
        ) : null}
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder="name@hagz.app"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="mt-4">
          <Field
            label="Password"
            type={shown ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(undefined);
            }}
            error={error}
            trailing={
              <button
                type="button"
                onClick={() => setShown(!shown)}
                className="cursor-pointer text-label font-medium text-ink-2 hover:text-ink"
              >
                {shown ? "Hide" : "Show"}
              </button>
            }
          />
        </div>
        <div className="mt-6">
          <Button type="submit" loading={busy} disabled={!email.trim() || !password}>
            Continue
          </Button>
        </div>
        <p className="mt-5 text-center text-label text-ink-2">
          Forgot your password? Ask another admin to reset it.
        </p>
      </form>
    </PageShell>
  );
}
