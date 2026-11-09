"use client";

import type {
  AdminAmenity,
  AdminLocation,
  AdminMarketplace,
  CreateMarketplace,
  Locality,
} from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { FormDialog } from "@/admin/dialog";
import { message, send } from "@/admin/errors";
import { Field, SelectField } from "@/admin/field";
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

export function MarketplaceDialog({
  marketplace,
  onClose,
  onDone,
}: {
  // Undefined to add one.
  marketplace?: AdminMarketplace;
  onClose: Close;
  onDone: Done;
}) {
  const editing = Boolean(marketplace);
  const [form, setForm] = useState({
    code: marketplace?.code ?? "",
    en: marketplace?.names.en ?? "",
    ar: marketplace?.names.ar ?? "",
    currency: marketplace?.currency ?? "",
    dialCode: marketplace?.dialCode ?? "+",
    timezone: marketplace?.timezone ?? "",
    tax: marketplace ? String(marketplace.taxRate / 100) : "",
    commission: marketplace ? String(marketplace.commissionRate / 100) : "",
    isActive: marketplace?.isActive ?? false,
  });
  const { busy, error, setError, run } = useSubmit(onDone, onClose);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [field]: event.target.value });
  const locked = marketplace?.inUse ?? false;

  const submit = () => {
    const taxRate = basisPoints(form.tax);
    const commissionRate = basisPoints(form.commission);
    if (taxRate === null || commissionRate === null) {
      setError("VAT and commission are percentages between 0 and 100.");
      return;
    }
    const body: CreateMarketplace = {
      code: form.code.trim().toUpperCase(),
      names: { en: form.en.trim(), ar: form.ar.trim() },
      currency: form.currency.trim().toUpperCase(),
      dialCode: form.dialCode.trim(),
      timezone: form.timezone.trim(),
      taxRate,
      commissionRate,
    };
    void run(
      marketplace
        ? send(
            api.PATCH("/v1/admin/marketplaces/{id}", {
              params: { path: { id: marketplace.id } },
              body: { ...body, isActive: form.isActive },
            }),
          )
        : send(api.POST("/v1/admin/marketplaces", { body })),
    );
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={editing ? `Edit ${marketplace?.names.en}` : "Add a marketplace"}
      subtitle={editing ? undefined : "A country Hagz operates in. It starts hidden from the apps."}
      submitLabel={editing ? "Save" : "Add marketplace"}
      busy={busy}
      error={error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="English name" value={form.en} onChange={set("en")} required autoFocus />
        <Field label="Arabic name" dir="rtl" value={form.ar} onChange={set("ar")} required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field
          label="Country code"
          placeholder="EG"
          maxLength={2}
          value={form.code}
          onChange={set("code")}
          disabled={locked}
          required
        />
        <Field
          label="Currency"
          placeholder="EGP"
          maxLength={3}
          value={form.currency}
          onChange={set("currency")}
          disabled={locked}
          required
        />
        <Field
          label="Dial code"
          placeholder="+20"
          value={form.dialCode}
          onChange={set("dialCode")}
          required
        />
      </div>
      {locked ? (
        <p className="-mt-2 text-caption text-ink-2">
          The country code and currency are fixed: it has locations, venues or amenities.
        </p>
      ) : null}
      <Field
        label="Time zone"
        placeholder="Africa/Cairo"
        value={form.timezone}
        onChange={set("timezone")}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="VAT (%)"
          inputMode="decimal"
          placeholder="14"
          value={form.tax}
          onChange={set("tax")}
          required
        />
        <Field
          label="Commission (%)"
          inputMode="decimal"
          placeholder="10"
          value={form.commission}
          onChange={set("commission")}
          required
        />
      </div>
      {editing ? (
        <label className="flex cursor-pointer items-center gap-2.5 text-label text-ink">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-ink"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          Live in the apps
        </label>
      ) : null}
      {editing ? (
        <p className="-mt-2 text-caption text-ink-2">
          New VAT and commission apply to bookings made from now on.
        </p>
      ) : null}
    </FormDialog>
  );
}

// --- Location ---

const localities = Object.entries(localityLabel).map(([value, label]) => ({ value, label }));

export function LocationDialog({
  marketplace,
  parent,
  location,
  onClose,
  onDone,
}: {
  marketplace: AdminMarketplace;
  // Adding: where it goes (null for the top). Editing: the location.
  parent?: AdminLocation | null;
  location?: AdminLocation;
  onClose: Close;
  onDone: Done;
}) {
  const [form, setForm] = useState({
    en: location?.names.en ?? "",
    ar: location?.names.ar ?? "",
    // A child is usually one step finer than its parent; a sensible starting point only.
    locality: (location?.locality ?? (parent ? "DISTRICT" : "GOVERNORATE")) as Locality,
  });
  const { busy, error, run } = useSubmit(onDone, onClose);
  const names = { en: form.en.trim(), ar: form.ar.trim() };

  const submit = () =>
    void run(
      location
        ? send(
            api.PATCH("/v1/admin/locations/{id}", {
              params: { path: { id: location.id } },
              body: { names, locality: form.locality },
            }),
          )
        : send(
            api.POST("/v1/admin/marketplaces/{id}/locations", {
              params: { path: { id: marketplace.id } },
              body: { parentId: parent?.id ?? null, locality: form.locality, names },
            }),
          ),
    );

  const where = parent ? `Under ${parent.names.en}, ${marketplace.names.en}` : marketplace.names.en;
  return (
    <FormDialog
      open
      onClose={onClose}
      title={location ? `Edit ${location.names.en}` : "Add a location"}
      subtitle={location ? `Slug: ${location.slug} (it doesn't change)` : where}
      submitLabel={location ? "Save" : "Add location"}
      busy={busy}
      error={error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="English name"
          hint={location ? undefined : "Also makes the slug in URLs."}
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
        options={localities}
        value={form.locality}
        onChange={(event) => setForm({ ...form, locality: event.target.value as Locality })}
      />
    </FormDialog>
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
