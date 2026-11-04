"use client";

import { useEffect, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { send } from "@/admin/errors";
import { PageShell } from "@/admin/page-shell";

interface Admin {
  name: string;
  email: string;
}

// Admin home. The dashboard layout isn't designed yet, so for now this only says who is signed in
// and lets them sign out. Signed out, it sends them to sign in.
export default function AdminHome() {
  const [admin, setAdmin] = useState<Admin>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void send(api.GET("/v1/auth/admin/me")).then((result) => {
      if (result.ok) setAdmin(result.data);
      else window.location.replace("/admin/login");
    });
  }, []);

  if (!admin) return null;

  const signOut = async () => {
    setBusy(true);
    await send(api.DELETE("/v1/auth/admin/sessions/current"));
    window.location.assign("/admin/login");
  };

  return (
    <PageShell title={`Signed in as ${admin.name}`} subtitle={admin.email}>
      <Button variant="secondary" loading={busy} onClick={() => void signOut()}>
        Sign out
      </Button>
    </PageShell>
  );
}
