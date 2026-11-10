"use client";

import type { AdminMarketplace } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { ChooserDialog } from "@/admin/chooser";
import { send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { useSubmit } from "./forms";

// Add amenity, in the add flows' white modal: its names and its key in one step. It starts on,
// so venues in the marketplace can pick it right away.

// The API's rule for keys (CreateAmenity), checked here so the button stays grey until it passes.
const KEY = /^[a-z][a-z0-9_]{1,39}$/;

export function AddAmenityDialog({
  marketplace,
  onClose,
  onDone,
}: {
  marketplace: AdminMarketplace;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ en: "", ar: "", key: "" });
  const { busy, run } = useSubmit(onDone, onClose);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [field]: event.target.value });

  const key = form.key.trim();
  // Like the sign-in page: the button stays grey until everything it needs is there.
  const ready = form.en.trim() !== "" && form.ar.trim() !== "" && KEY.test(key);

  const submit = () =>
    ready &&
    void run(() =>
      send(
        api.POST("/v1/admin/marketplaces/{id}/amenities", {
          params: { path: { id: marketplace.id } },
          body: { key, names: { en: form.en.trim(), ar: form.ar.trim() } },
        }),
      ),
    );

  return (
    <ChooserDialog
      onClose={onClose}
      title="Add amenity"
      description={`Something venues in ${marketplace.names.en} can offer.`}
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-amenity" size="small" loading={busy} disabled={!ready}>
            Add amenity
          </Button>
        </>
      }
    >
      <form
        id="add-amenity"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="English name" value={form.en} onChange={set("en")} required autoFocus />
          <Field label="Arabic name" dir="rtl" value={form.ar} onChange={set("ar")} required />
        </div>
        <Field
          label="Key"
          placeholder="changing_rooms"
          hint="Lowercase letters, digits and underscores. Fixed once added."
          value={form.key}
          onChange={set("key")}
          required
        />
      </form>
    </ChooserDialog>
  );
}
