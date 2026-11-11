"use client";

import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { Authenticator, type Challenge } from "@/admin/authenticator";
import { Button } from "@/admin/button";
import { message, problemCode, send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { PageShell } from "@/admin/page-shell";

const MIN_PASSWORD = 8;

// Where an admin invitation link lands (ROUTES.adminInvitation). The token is in the URL fragment,
// which browsers never send to a server, so it's read here and posted to the API. Accepting creates
// the account and answers with a challenge: the new admin sets up the authenticator straight away.
export default function AcceptAdminInvitation() {
  // undefined while the fragment is read; "" when the link has none.
  const [token, setToken] = useState<string>();
  const [ended, setEnded] = useState(false);
  const [challenge, setChallenge] = useState<Challenge>();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // The token stays in the address bar so a refresh still works. It's single-use, so a copy left
  // in history is dead once it's used.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  }, []);

  // The account exists by now, so running out of time means signing in, not accepting again.
  const toSignIn = useCallback(() => window.location.assign("/admin/login"), []);

  if (token === undefined) return null;

  if (!token) {
    return (
      <PageShell
        title="This link is incomplete"
        subtitle="The link you followed is missing some details. Please open it again from your invitation email."
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
        title="This invitation has ended"
        subtitle="It was already used, cancelled, or it’s more than 48 hours old. Ask the admin who invited you to send a new one."
      >
        <Button variant="secondary" onClick={toSignIn}>
          Go to sign in
        </Button>
      </PageShell>
    );
  }

  if (challenge) return <Authenticator challenge={challenge} onRestart={toSignIn} />;

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const result = await send(
      api.POST("/v1/auth/admin/invitations/accept", {
        body: { token, name: name.trim(), password },
      }),
    );
    setBusy(false);
    if (result.ok) {
      setChallenge(result.data);
      return;
    }
    if (problemCode(result.error) === "INVITATION_INVALID") setEnded(true);
    else setError(message(result.error));
  };

  return (
    <PageShell
      title="Create your account"
      subtitle="You’ve been invited to help manage the platform."
    >
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Your name"
          autoComplete="name"
          autoFocus
          placeholder="Your full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-4">
          <Field
            label="Password"
            type={shown ? "text" : "password"}
            autoComplete="new-password"
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
        </div>
        <div className="mt-6">
          <Button
            type="submit"
            loading={busy}
            disabled={!name.trim() || password.length < MIN_PASSWORD}
          >
            Create account
          </Button>
        </div>
        <p className="mt-5 text-center text-caption text-ink-2">
          Next, you’ll set up an authenticator app.
        </p>
      </form>
    </PageShell>
  );
}
