"use client";

import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { ChoiceCard, ChoiceTag, ChooserDialog, ChooserSection } from "@/admin/chooser";
import { send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { Flag } from "@/admin/flag";
import { countries, countryNames, type Country } from "./countries";
import { basisPoints, useSubmit } from "./forms";

// Add marketplace, in two steps: pick the country from a grid of cards (flag, name, currency),
// then confirm its names and set VAT and commission. Countries that already have a marketplace
// stay in the grid, greyed out.

export function AddMarketplaceDialog({
  taken,
  onClose,
  onDone,
}: {
  // Codes of the marketplaces that exist.
  taken: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [country, setCountry] = useState<Country>();
  const frame = { onClose, onBack: () => setCountry(undefined) };

  if (!country) {
    return (
      <ChooserDialog
        onClose={onClose}
        title="Add marketplace"
        description="Its currency, dial code and time zone come with it. It starts hidden from the apps."
      >
        <ChooserSection columns={2}>
          {countries.map((option) => {
            const added = taken.includes(option.code);
            return (
              <ChoiceCard
                key={option.code}
                tag={<ChoiceTag>{added ? "Added" : option.currency}</ChoiceTag>}
                title={
                  <>
                    <Flag code={option.code} size="1.25rem" />
                    {countryNames(option.code).en}
                  </>
                }
                disabled={added}
                onSelect={() => setCountry(option)}
              />
            );
          })}
        </ChooserSection>
      </ChooserDialog>
    );
  }

  return <Details frame={frame} country={country} onDone={onDone} />;
}

function Details({
  frame,
  country,
  onDone,
}: {
  frame: { onClose: () => void; onBack: () => void };
  country: Country;
  onDone: () => void;
}) {
  const names = countryNames(country.code);
  const [form, setForm] = useState({
    en: names.en,
    ar: names.ar,
    tax: String(country.vat),
    commission: "",
  });
  const { busy, error, run } = useSubmit(onDone, frame.onClose);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [field]: event.target.value });

  const taxRate = basisPoints(form.tax);
  const commissionRate = basisPoints(form.commission);
  // Like the sign-in page: the button stays grey until everything it needs is there.
  const ready =
    form.en.trim() !== "" && form.ar.trim() !== "" && taxRate !== null && commissionRate !== null;

  const submit = () => {
    if (!ready) return;
    void run(() =>
      send(
        api.POST("/v1/admin/marketplaces", {
          body: {
            code: country.code,
            names: { en: form.en.trim(), ar: form.ar.trim() },
            currency: country.currency,
            dialCode: country.dialCode,
            timezone: country.timezone,
            taxRate,
            commissionRate,
          },
        }),
      ),
    );
  };

  return (
    <ChooserDialog
      {...frame}
      description={`${country.code} · ${country.currency} · ${country.dialCode} · ${country.timezone}`}
      title={
        <>
          <Flag code={country.code} size="1.25rem" />
          Add {names.en}
        </>
      }
      footer={
        <>
          <Button variant="secondary" size="small" onClick={frame.onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-marketplace"
            size="small"
            loading={busy}
            disabled={!ready}
          >
            Add marketplace
          </Button>
        </>
      }
    >
      <form
        id="add-marketplace"
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
            hint="The standard rate there today. Check it before adding."
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
            autoFocus
          />
        </div>
        {error ? (
          <p role="alert" className="rounded-field bg-red/10 px-4 py-3 text-label text-red">
            {error}
          </p>
        ) : null}
      </form>
    </ChooserDialog>
  );
}
