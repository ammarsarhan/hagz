"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Button } from "./button";
import { CodeInput } from "./code-input";
import { message, problemCode, send } from "./errors";
import { PageShell } from "./page-shell";

export interface Challenge {
  challengeToken: string;
  next: "TOTP" | "TOTP_SETUP";
}

interface Setup {
  secret: string;
  qr: string;
}

// After the password (or accepting an invitation): set up the authenticator the first time, then
// the six-digit code from it. Either way the code finishes signing in.
export function Authenticator({
  challenge,
  email,
  onRestart,
}: {
  challenge: Challenge;
  email?: string;
  // The challenge ran out (it's short-lived and single use): back to the start, saying why.
  onRestart: (notice: string) => void;
}) {
  const [mode, setMode] = useState(challenge.next);
  const [setup, setSetup] = useState<Setup>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Each call makes a new secret, so it's asked for once even when React runs effects twice.
  const asked = useRef(false);

  useEffect(() => {
    if (mode !== "TOTP_SETUP" || asked.current) return;
    asked.current = true;
    void (async () => {
      const result = await send(
        api.POST("/v1/auth/admin/sessions/totp-setup", {
          body: { challengeToken: challenge.challengeToken },
        }),
      );
      if (!result.ok) {
        const failure = problemCode(result.error);
        if (failure === "TOTP_ALREADY_SET_UP") setMode("TOTP");
        else if (failure === "CHALLENGE_EXPIRED") onRestart(message(result.error));
        else setError(message(result.error));
        return;
      }
      const qr = await QRCode.toDataURL(result.data.otpauthUri, {
        margin: 0,
        width: 300,
        color: { dark: "#0b0b0c", light: "#ffffff" },
      });
      setSetup({ secret: result.data.secret, qr });
    })();
  }, [mode, challenge.challengeToken, onRestart]);

  const submit = async (value = code) => {
    if (value.length < 6 || busy) return;
    setBusy(true);
    const result = await send(
      api.POST("/v1/auth/admin/sessions/totp", {
        body: { challengeToken: challenge.challengeToken, code: value },
      }),
    );
    if (result.ok) {
      window.location.assign("/admin");
      return;
    }
    setBusy(false);
    if (problemCode(result.error) === "CHALLENGE_EXPIRED") {
      onRestart(message(result.error));
      return;
    }
    setCode("");
    setError(message(result.error));
  };

  const codeInput = (
    <CodeInput
      label="Code from your authenticator app"
      value={code}
      onChange={(next) => {
        setCode(next);
        setError(undefined);
      }}
      onComplete={(full) => void submit(full)}
      error={error}
      disabled={busy}
    />
  );
  const restart = (
    <Button variant="ghost" onClick={() => onRestart("")}>
      {mode === "TOTP" ? "Use a different account" : "Back to sign in"}
    </Button>
  );

  if (mode === "TOTP") {
    return (
      <PageShell
        title="Enter your code"
        subtitle={
          email ? `From your authenticator app, for ${email}.` : "From your authenticator app."
        }
      >
        {codeInput}
        <div className="mt-6 flex flex-col gap-2">
          <Button disabled={code.length < 6} loading={busy} onClick={() => void submit()}>
            Sign in
          </Button>
          {restart}
        </div>
      </PageShell>
    );
  }

  const groups = setup?.secret.match(/.{1,4}/g)?.join(" ") ?? "";
  return (
    <PageShell
      compact
      title="Set up your authenticator"
      subtitle="Scan this code with an authenticator app, like Google Authenticator or 1Password. You’ll use it every time you sign in."
    >
      <div className="flex flex-col items-center">
        <div className="flex size-[184px] items-center justify-center rounded-hud border border-border bg-white">
          {setup ? (
            // A data URL made in the browser from the otpauth URI; next/image has nothing to optimise.
            <img src={setup.qr} alt="QR code for your authenticator app" width={150} height={150} />
          ) : (
            <span className="size-6 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />
          )}
        </div>
        <p className="mt-5 text-label text-ink-2">
          Can’t scan it? Enter this key in the app instead.
        </p>
        <div className="mt-2 flex h-[52px] w-full items-center justify-between gap-3 rounded-field bg-field pr-2.5 pl-4">
          <span className="text-caption font-medium whitespace-nowrap text-ink tabular-nums">
            {groups}
          </span>
          <button
            type="button"
            disabled={!setup}
            aria-label={copied ? "Key copied" : "Copy key"}
            title={copied ? "Copied" : "Copy"}
            onClick={() => {
              if (!setup) return;
              void navigator.clipboard.writeText(setup.secret).then(() => setCopied(true));
            }}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {copied ? (
                <path d="M5 12l5 5l10 -10" />
              ) : (
                <>
                  <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
                  <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
      <p className="mt-7 mb-2 text-label font-medium text-ink-2">Code from the app</p>
      {codeInput}
      <div className="mt-6 flex flex-col gap-2">
        <Button disabled={code.length < 6 || !setup} loading={busy} onClick={() => void submit()}>
          Finish setup
        </Button>
        {restart}
      </div>
    </PageShell>
  );
}
