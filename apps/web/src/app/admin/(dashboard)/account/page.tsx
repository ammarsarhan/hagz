"use client";

import { IconLogout } from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/admin/page-header";
import { signOut, useAdmin } from "@/admin/session";

// The signed-in admin's own account: who they are, and signing out. Changing the password or the
// authenticator can join it later.
export default function Account() {
  const admin = useAdmin();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader title="Account" subtitle="Your Hagz Admin account." />
      <section className="mt-8 max-w-[35rem] overflow-hidden rounded-hud border border-border bg-white">
        <dl className="divide-y divide-border">
          <div className="flex items-center justify-between gap-6 px-5 py-4">
            <dt className="text-label text-ink-2">Name</dt>
            <dd className="text-body font-medium text-ink">{admin.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-6 px-5 py-4">
            <dt className="text-label text-ink-2">Email</dt>
            <dd className="text-body font-medium text-ink">{admin.email}</dd>
          </div>
        </dl>
      </section>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signOut();
        }}
        className="mt-6 flex cursor-pointer items-center gap-2 rounded-full bg-chip px-5 py-2.5 text-label font-semibold text-ink hover:bg-border disabled:opacity-60"
      >
        <IconLogout size={18} className="size-[1.125rem]" stroke={1.75} />
        Sign out
      </button>
    </>
  );
}
