"use client";

import type {
  AdminAmenity,
  AdminLocation,
  AdminMarketplace,
  Boundary,
  Coordinates,
  Locality,
} from "@hagz/contracts";
import { useRef, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Tag } from "@/admin/data-table";
import { PanelSection, ReadOnlyRow, SidePanel } from "@/admin/side-panel";
import { send } from "@/admin/errors";
import { Field, SelectField } from "@/admin/field";
import { Flag } from "@/admin/flag";
import { kindOrder } from "./countries";
import { formatCenter, mapsLink, parseCenter, readBoundary, shapeCount } from "./geo";
import { IconPicker } from "./icon-picker";
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
  // The border to save: left as it is (undefined), removed (null) or a new one from a file.
  const [border, setBorder] = useState<BorderChange>();
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, run } = useSubmit(onDone, hide);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [field]: event.target.value });

  const taxRate = basisPoints(form.tax);
  const commissionRate = basisPoints(form.commission);
  const changed =
    border !== undefined ||
    (Object.keys(initial) as (keyof typeof initial)[]).some(
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
            ...(border === undefined ? {} : { boundary: border && border.boundary }),
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
        <PanelSection title="Border">
          <BorderField has={marketplace.hasBoundary} change={border} onChange={setBorder} />
        </PanelSection>
      </form>
    </SidePanel>
  );
}

type BorderChange = { boundary: Boundary; file: string } | null;

// The country's border, which venue pins must fall inside. The API only says whether there is one,
// so this shows that, takes a GeoJSON file to replace it, and can remove it.
function BorderField({
  has,
  change,
  onChange,
}: {
  has: boolean;
  change: BorderChange | undefined;
  onChange: (change: BorderChange | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const load = async (file: File) => {
    try {
      onChange({ boundary: readBoundary(await file.text()), file: file.name });
      setError(undefined);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That file couldn't be read.");
    }
  };

  const status =
    change === undefined
      ? has
        ? { tag: <Tag tone="on">Set</Tag>, line: "Venue pins must fall inside it." }
        : { tag: <Tag>None</Tag>, line: "Without one, a pin anywhere is taken." }
      : change === null
        ? { tag: <Tag>Removed on save</Tag>, line: "Pins won't be checked against a border." }
        : {
            tag: <Tag tone="on">New on save</Tag>,
            line: `${change.file}: ${shapeCount(change.boundary) === 1 ? "1 shape" : `${String(shapeCount(change.boundary))} shapes`}.`,
          };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-label text-ink">Border {status.tag}</span>
          <span className="text-caption text-ink-2">{status.line}</span>
        </span>
        <span className="flex gap-2">
          {change !== undefined ? (
            <Button variant="ghost" size="small" onClick={() => onChange(undefined)}>
              Undo
            </Button>
          ) : has ? (
            <Button variant="ghost" size="small" onClick={() => onChange(null)}>
              Remove
            </Button>
          ) : null}
          <Button variant="secondary" size="small" onClick={() => input.current?.click()}>
            {has || change ? "Replace" : "Upload GeoJSON"}
          </Button>
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Border file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // The same file can be picked again after an Undo.
          event.target.value = "";
          if (file) void load(file);
        }}
      />
      {error ? <p className="text-caption font-medium text-red">{error}</p> : null}
    </div>
  );
}

// --- Location ---

// Where an area is, roughly: a venue's pin suggests the areas whose centres are nearest, and must be
// within 15 km of the one it's listed under. Left empty, the area is never suggested.
export function CenterField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const center = parseCenter(value);
  const invalid = value.trim() !== "" && !center;
  return (
    <Field
      label="Latitude, longitude"
      placeholder="30.04440, 31.23570"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={invalid ? "Two numbers, latitude then longitude, like 30.0444, 31.2357." : undefined}
      hint="Right-click the middle of the area in Google Maps and paste what it copies. Empty: never suggested for a pin."
      trailing={
        center ? (
          <a
            href={mapsLink(center)}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-label font-medium text-primary hover:underline"
          >
            Check on map
          </a>
        ) : null
      }
    />
  );
}

// The centre to send: undefined while it's unchanged or invalid, null to clear it.
export const centerChange = (
  text: string,
  current: Coordinates | null,
): { valid: boolean; value: Coordinates | null | undefined } => {
  if (text.trim() === "") return { valid: true, value: current ? null : undefined };
  const center = parseCenter(text);
  if (!center) return { valid: false, value: undefined };
  const same =
    current !== null &&
    Math.abs(current.latitude - center.latitude) < 1e-7 &&
    Math.abs(current.longitude - center.longitude) < 1e-7;
  return { valid: true, value: same ? undefined : center };
};

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
  const initial = {
    en: location.names.en,
    ar: location.names.ar,
    locality: location.locality,
    center: formatCenter(location.center),
  };
  const [form, setForm] = useState(initial);
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, run } = useSubmit(onDone, hide);
  const center = centerChange(form.center, location.center);
  const changed =
    form.en !== initial.en ||
    form.ar !== initial.ar ||
    form.locality !== initial.locality ||
    center.value !== undefined;
  const ready = changed && center.valid && form.en.trim() !== "" && form.ar.trim() !== "";

  const submit = () => {
    if (!ready) return;
    void run(() =>
      send(
        api.PATCH("/v1/admin/locations/{id}", {
          params: { path: { id: location.id } },
          body: {
            names: { en: form.en.trim(), ar: form.ar.trim() },
            locality: form.locality,
            ...(center.value === undefined ? {} : { center: center.value }),
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
        <PanelSection title="Centre">
          <CenterField
            value={form.center}
            onChange={(value) => setForm({ ...form, center: value })}
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
export function Toggle({
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

// What "Placeable" means, in the add dialog and the edit panel alike.
export const PLACEABLE_HINT =
  "Owners can draw it on their venue's layout, like parking or a café. Turned off, it comes off every layout.";

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
  const initial = {
    en: amenity.names.en,
    ar: amenity.names.ar,
    icon: amenity.icon,
    isActive: amenity.isActive,
    placeable: amenity.placeable,
  };
  const [form, setForm] = useState(initial);
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, run } = useSubmit(onDone, hide);
  const changed =
    form.en !== initial.en ||
    form.ar !== initial.ar ||
    form.icon !== initial.icon ||
    form.isActive !== initial.isActive ||
    form.placeable !== initial.placeable;
  const ready = changed && form.en.trim() !== "" && form.ar.trim() !== "";

  const submit = () => {
    if (!ready) return;
    void run(() =>
      send(
        api.PATCH("/v1/admin/amenities/{id}", {
          params: { path: { id: amenity.id } },
          body: {
            names: { en: form.en.trim(), ar: form.ar.trim() },
            icon: form.icon,
            isActive: form.isActive,
            placeable: form.placeable,
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
        <PanelSection title="Icon">
          <IconPicker
            label="Shown beside it in the apps"
            value={form.icon}
            onChange={(icon) => setForm({ ...form, icon })}
          />
        </PanelSection>
        <PanelSection title="Availability">
          <Toggle
            label="Visible"
            hint="Turned off, venues can't newly pick it. Venues that offer it keep it."
            checked={form.isActive}
            onChange={(isActive) => setForm({ ...form, isActive })}
          />
          <Toggle
            label="Placeable"
            hint={PLACEABLE_HINT}
            checked={form.placeable}
            onChange={(placeable) => setForm({ ...form, placeable })}
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
