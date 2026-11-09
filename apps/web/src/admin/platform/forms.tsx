"use client";

import type { AdminAmenity, AdminLocation, AdminMarketplace, Locality } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { SidePanel } from "@/admin/side-panel";
import { FormDialog } from "@/admin/dialog";
import { message, send } from "@/admin/errors";
import { Field, SelectField } from "@/admin/field";
import { Flag } from "@/admin/flag";
import { kindOrder } from "./countries";
import { KindIcon } from "./kind-icon";
import { localityLabel } from "./model";

// The Platform page's forms. Each one sends its request, shows the API's message if it's refused,
// and on success tells the page to reload.

type Close = () => void;
type Done = () => void;

// Shared submit plumbing: busy while waiting, the error if refused, close and reload if not.
export const useSubmit = (onDone: Done, onClose: Close) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (request: Promise<{ ok: boolean; error?: unknown }>) => {
    setBusy(true);
    setError(undefined);
    const result = await request;
    setBusy(false);
    if (!result.ok) {
      setError(message(result.error));
      return;
    }
    onClose();
    onDone();
  };
  return { busy, error, setError, run };
};

// Percent typed by a person ("14", "2.5") to basis points; null when it isn't a valid rate.
export const basisPoints = (text: string) => {
  const value = Number(text.trim());
  if (text.trim() === "" || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
};

// --- Marketplace ---

// Edit marketplace, in a side panel over the list.
export function EditMarketplacePanel({
  marketplace,
  lastLive,
  onClose,
  onDone,
}: {
  marketplace: AdminMarketplace;
  // The only live marketplace: the API won't hide it (LAST_LIVE_MARKETPLACE), so the switch is locked.
  lastLive: boolean;
  onClose: Close;
  onDone: Done;
}) {
  const initial = {
    en: marketplace.names.en,
    ar: marketplace.names.ar,
    tax: String(marketplace.taxRate / 100),
    commission: String(marketplace.commissionRate / 100),
    dialCode: marketplace.dialCode,
    timezone: marketplace.timezone,
    isActive: marketplace.isActive,
  };
  const [form, setForm] = useState(initial);
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, error, run } = useSubmit(onDone, hide);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [field]: event.target.value });

  const taxRate = basisPoints(form.tax);
  const commissionRate = basisPoints(form.commission);
  const changed = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (field) => form[field] !== initial[field],
  );
  // Save stays grey until something changed and everything is valid.
  const ready =
    changed &&
    form.en.trim() !== "" &&
    form.ar.trim() !== "" &&
    form.dialCode.trim() !== "" &&
    form.timezone.trim() !== "" &&
    taxRate !== null &&
    commissionRate !== null;

  const submit = () => {
    if (!ready) return;
    void run(
      send(
        api.PATCH("/v1/admin/marketplaces/{id}", {
          params: { path: { id: marketplace.id } },
          body: {
            names: { en: form.en.trim(), ar: form.ar.trim() },
            dialCode: form.dialCode.trim(),
            timezone: form.timezone.trim(),
            taxRate,
            commissionRate,
            isActive: form.isActive,
          },
        }),
      ),
    );
  };

  return (
    <SidePanel
      open={open}
      onRequestClose={hide}
      onExited={onClose}
      title={
        <>
          <Flag code={marketplace.code} size="1.25rem" />
          Edit {marketplace.names.en}
        </>
      }
      description="Changes apply to bookings made from now on."
      footer={<EditButtons formId="edit-marketplace" onClose={hide} busy={busy} ready={ready} />}
    >
      <form
        id="edit-marketplace"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="English name" value={form.en} onChange={set("en")} required />
          <Field label="Arabic name" dir="rtl" value={form.ar} onChange={set("ar")} required />
          <Field
            label="VAT (%)"
            inputMode="decimal"
            value={form.tax}
            onChange={set("tax")}
            required
          />
          <Field
            label="Commission (%)"
            inputMode="decimal"
            value={form.commission}
            onChange={set("commission")}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Shown for reference: the country set them, and nothing can change them now. */}
          <Field label="Country code" value={marketplace.code} disabled readOnly />
          <Field label="Currency" value={marketplace.currency} disabled readOnly />
          <Field label="Dial code" value={form.dialCode} onChange={set("dialCode")} required />
          <Field label="Time zone" value={form.timezone} onChange={set("timezone")} required />
        </div>
        <Toggle
          label="Live in the apps"
          hint={
            lastLive
              ? "It's the only live marketplace. Make another one live before hiding it."
              : "Hidden marketplaces don't show to customers or staff."
          }
          checked={form.isActive}
          disabled={lastLive}
          onChange={(isActive) => setForm({ ...form, isActive })}
        />
        <ErrorNote error={error} />
      </form>
    </SidePanel>
  );
}

// --- Location ---

// Edit location, in a side panel over the table.
export function EditLocationPanel({
  marketplace,
  location,
  onClose,
  onDone,
}: {
  marketplace: AdminMarketplace;
  location: AdminLocation;
  onClose: Close;
  onDone: Done;
}) {
  const initial = { en: location.names.en, ar: location.names.ar, locality: location.locality };
  const [form, setForm] = useState(initial);
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, error, run } = useSubmit(onDone, hide);
  const changed =
    form.en !== initial.en || form.ar !== initial.ar || form.locality !== initial.locality;
  const ready = changed && form.en.trim() !== "" && form.ar.trim() !== "";

  const submit = () => {
    if (!ready) return;
    void run(
      send(
        api.PATCH("/v1/admin/locations/{id}", {
          params: { path: { id: location.id } },
          body: { names: { en: form.en.trim(), ar: form.ar.trim() }, locality: form.locality },
        }),
      ),
    );
  };

  return (
    <SidePanel
      open={open}
      onRequestClose={hide}
      onExited={onClose}
      title={
        <>
          <KindIcon kind={form.locality} size="1.25rem" />
          Edit {location.names.en}
        </>
      }
      // The slug is part of public URLs, so renaming doesn't change it; say so up front.
      description={`${localityLabel[location.locality]} in ${marketplace.names.en} · /${location.slug}, which stays as it is`}
      footer={<EditButtons formId="edit-location" onClose={hide} busy={busy} ready={ready} />}
    >
      <form
        id="edit-location"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="English name"
            value={form.en}
            onChange={(event) => setForm({ ...form, en: event.target.value })}
            required
            autoFocus
          />
          <Field
            label="Arabic name"
            dir="rtl"
            value={form.ar}
            onChange={(event) => setForm({ ...form, ar: event.target.value })}
            required
          />
        </div>
        <SelectField
          label="Kind"
          options={kindOrder.map((kind) => ({ value: kind, label: localityLabel[kind] }))}
          value={form.locality}
          onChange={(event) => setForm({ ...form, locality: event.target.value as Locality })}
        />
        <ErrorNote error={error} />
      </form>
    </SidePanel>
  );
}

// --- Shared pieces of the edit modals ---

function EditButtons({
  formId,
  onClose,
  busy,
  ready,
}: {
  formId: string;
  onClose: Close;
  busy: boolean;
  ready: boolean;
}) {
  return (
    <>
      <Button variant="secondary" size="small" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" form={formId} size="small" loading={busy} disabled={!ready}>
        Save changes
      </Button>
    </>
  );
}

function ErrorNote({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="rounded-field bg-red/10 px-4 py-3 text-label text-red">
      {error}
    </p>
  ) : null;
}

// An on/off switch with its label and a line under it.
function Toggle({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  // Locked in place, with the hint saying why.
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    // Set a little apart from the fields above: it's a setting, not part of the data.
    <label
      className={`mt-2 flex items-center justify-between gap-6 ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="flex flex-col">
        <span className="text-label font-medium text-ink">{label}</span>
        <span className="text-caption text-ink-2">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors peer-disabled:opacity-40 peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 ${
          checked ? "bg-ink" : "bg-[#d5d8dd]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}

// --- Amenity ---

export function AmenityDialog({
  marketplace,
  amenity,
  onClose,
  onDone,
}: {
  marketplace?: AdminMarketplace;
  amenity?: AdminAmenity;
  onClose: Close;
  onDone: Done;
}) {
  const [form, setForm] = useState({
    key: amenity?.key ?? "",
    en: amenity?.names.en ?? "",
    ar: amenity?.names.ar ?? "",
  });
  const { busy, error, run } = useSubmit(onDone, onClose);
  const names = { en: form.en.trim(), ar: form.ar.trim() };

  const submit = () =>
    void run(
      amenity
        ? send(
            api.PATCH("/v1/admin/amenities/{id}", {
              params: { path: { id: amenity.id } },
              body: { names },
            }),
          )
        : send(
            api.POST("/v1/admin/marketplaces/{id}/amenities", {
              params: { path: { id: marketplace?.id ?? "" } },
              body: { key: form.key.trim(), names },
            }),
          ),
    );

  return (
    <FormDialog
      open
      onClose={onClose}
      title={amenity ? `Edit ${amenity.names.en}` : "Add an amenity"}
      subtitle={amenity ? undefined : `Something venues in ${marketplace?.names.en} can offer.`}
      submitLabel={amenity ? "Save" : "Add amenity"}
      busy={busy}
      error={error}
      onSubmit={submit}
    >
      <Field
        label="Key"
        placeholder="changing_rooms"
        hint={
          amenity
            ? "Fixed once created."
            : "Lowercase letters, digits and underscores. Fixed once created."
        }
        value={form.key}
        onChange={(event) => setForm({ ...form, key: event.target.value })}
        disabled={Boolean(amenity)}
        required
        autoFocus={!amenity}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="English name"
          value={form.en}
          onChange={(event) => setForm({ ...form, en: event.target.value })}
          required
          autoFocus={Boolean(amenity)}
        />
        <Field
          label="Arabic name"
          dir="rtl"
          value={form.ar}
          onChange={(event) => setForm({ ...form, ar: event.target.value })}
          required
        />
      </div>
    </FormDialog>
  );
}

// --- Delete ---

export function DeleteDialog({
  title,
  description,
  request,
  onClose,
  onDone,
}: {
  title: string;
  description: string;
  request: () => Promise<{ ok: boolean; error?: unknown }>;
  onClose: Close;
  onDone: Done;
}) {
  const { busy, error, run } = useSubmit(onDone, onClose);
  return (
    <FormDialog
      open
      onClose={onClose}
      title={title}
      subtitle={description}
      submitLabel="Delete"
      danger
      busy={busy}
      error={error}
      onSubmit={() => void run(request())}
    />
  );
}
