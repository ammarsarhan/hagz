"use client";

import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { ChooserDialog } from "@/admin/chooser";
import { send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { useSubmit } from "@/admin/submit";

// Invite admin, in the add flows' white modal: just the email. The API emails the link, which works
// for 48 hours and replaces any earlier invitation to the same address.

// Enough to catch a typo before sending; the API checks it properly.
const looksLikeEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

export function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const { busy, run } = useSubmit(onDone, onClose);
  const ready = looksLikeEmail(email.trim());

  const submit = () =>
    ready &&
    void run(() => send(api.POST("/v1/admin/invitations", { body: { email: email.trim() } })));

  return (
    <ChooserDialog
      onClose={onClose}
      title="Invite admin"
      description="They'll get an email with a link to set up their account. It works for 48 hours."
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="invite-admin" size="small" loading={busy} disabled={!ready}>
            Send invitation
          </Button>
        </>
      }
    >
      <form
        id="invite-admin"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field
          label="Email"
          type="email"
          autoComplete="off"
          placeholder="name@hagz.app"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
      </form>
    </ChooserDialog>
  );
}
