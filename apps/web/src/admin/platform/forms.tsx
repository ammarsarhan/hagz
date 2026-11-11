"use client";

import type { AdminAmenity, AdminLocation, AdminMarketplace, Locality } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Tag } from "@/admin/data-table";
import { PanelSection, ReadOnlyRow, SidePanel } from "@/admin/side-panel";
import { send } from "@/admin/errors";
import { Field, SelectField } from "@/admin/field";
import { Flag } from "@/admin/flag";
import { kindOrder } from "./countries";
import { KindIcon } from "./kind-icon";
import { localityLabel } from "./model";
import { useSubmit } from "@/admin/submit";

// The Platform page's forms. Each one sends its request through useSubmit, which shows any error in
// the HUD, and on success tells the page to reload.

type Close = () => void;
type Done = () => void;

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
  const { busy, run } = useSubmit(onDone, hide);
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
    void run(() =>
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
          <Flag code={marketplace.code} size="1.5rem" />
          {marketplace.names.en}
          {marketplace.isActive ? <Tag tone="on">Live</Tag> : <Tag>Hidden</Tag>}
        </>
      }
      description="Changes apply to bookings made from now on."
      footer={<EditButtons formId="edit-marketplace" onClose={hide} busy={busy} ready={ready} />}
    >
      <form
        id="edit-marketplace"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <PanelSection title="Names">
          <div className="grid grid-cols-2 gap-3">
            <Field label="English" value={form.en} onChange={set("en")} required />
            <Field label="Arabic" dir="rtl" value={form.ar} onChange={set("ar")} required />
          </div>
        </PanelSection>
        <PanelSection title="Rates">
          <div className="grid grid-cols-2 gap-3">
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
        </PanelSection>
        <PanelSection title="Country">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dial code" value={form.dialCode} onChange={set("dialCode")} required />
            <Field label="Time zone" value={form.timezone} onChange={set("timezone")} required />
          </div>
          {/* Set by the country, and fixed once anything uses the marketplace. */}
          <div>
            <ReadOnlyRow label="Country code" value={marketplace.code} />
            <ReadOnlyRow label="Currency" value={marketplace.currency} />
          </div>
        </PanelSection>
        <PanelSection title="Visibility">
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
        </PanelSection>
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
  const { busy, run } = useSubmit(onDone, hide);
  const changed =
    form.en !== initial.en || form.ar !== initial.ar || form.locality !== initial.locality;
  const ready = changed && form.en.trim() !== "" && form.ar.trim() !== "";

  const submit = () => {
    if (!ready) return;
    void run(() =>
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
          {location.names.en}
        </>
      }
      description={`${localityLabel[location.locality]} in ${marketplace.names.en}`}
      footer={<EditButtons formId="edit-location" onClose={hide} busy={busy} ready={ready} />}
    >
      <form
        id="edit-location"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <PanelSection title="Names">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="English"
              value={form.en}
              onChange={(event) => setForm({ ...form, en: event.target.value })}
              required
              autoFocus
            />
            <Field
              label="Arabic"
              dir="rtl"
              value={form.ar}
              onChange={(event) => setForm({ ...form, ar: event.target.value })}
              required
            />
          </div>
        </PanelSection>
        <PanelSection title="Kind">
          <SelectField
            label="What kind of place it is"
            options={kindOrder.map((kind) => ({ value: kind, label: localityLabel[kind] }))}
            value={form.locality}
            onChange={(event) => setForm({ ...form, locality: event.target.value as Locality })}
          />
        </PanelSection>
        <PanelSection title="Link">
          {/* Made from the English name when it was added, and part of public URLs: renaming
              doesn't change it. */}
          <ReadOnlyRow label="URL" value={`/${location.slug}`} />
        </PanelSection>
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
    <label
      className={`flex items-center justify-between gap-6 ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="flex flex-col">
        <span className="text-label text-ink">{label}</span>
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

// Edit amenity, in a side panel over the table.
export function EditAmenityPanel({
  marketplace,
  amenity,
  onClose,
  onDone,
}: {
  marketplace: AdminMarketplace;
  amenity: AdminAmenity;
  onClose: Close;
  onDone: Done;
}) {
  const initial = { en: amenity.names.en, ar: amenity.names.ar, isActive: amenity.isActive };
  const [form, setForm] = useState(initial);
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, run } = useSubmit(onDone, hide);
  const changed =
    form.en !== initial.en || form.ar !== initial.ar || form.isActive !== initial.isActive;
  const ready = changed && form.en.trim() !== "" && form.ar.trim() !== "";

  const submit = () => {
    if (!ready) return;
    void run(() =>
      send(
        api.PATCH("/v1/admin/amenities/{id}", {
          params: { path: { id: amenity.id } },
          body: { names: { en: form.en.trim(), ar: form.ar.trim() }, isActive: form.isActive },
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
          {amenity.names.en}
          {amenity.isActive ? <Tag tone="on">On</Tag> : <Tag>Off</Tag>}
        </>
      }
      description={`Amenity in ${marketplace.names.en}`}
      footer={<EditButtons formId="edit-amenity" onClose={hide} busy={busy} ready={ready} />}
    >
      <form
        id="edit-amenity"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <PanelSection title="Names">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="English"
              value={form.en}
              onChange={(event) => setForm({ ...form, en: event.target.value })}
              required
              autoFocus
            />
            <Field
              label="Arabic"
              dir="rtl"
              value={form.ar}
              onChange={(event) => setForm({ ...form, ar: event.target.value })}
              required
            />
          </div>
        </PanelSection>
        <PanelSection title="Availability">
          <Toggle
            label="On for venues"
            hint="Turned off, venues can't newly pick it. Venues that offer it keep it."
            checked={form.isActive}
            onChange={(isActive) => setForm({ ...form, isActive })}
          />
        </PanelSection>
        <PanelSection title="Code">
          {/* Picked when it was added, and what the apps know it by: renaming doesn't change it. */}
          <ReadOnlyRow label="Key" value={amenity.key} />
        </PanelSection>
      </form>
    </SidePanel>
  );
}
