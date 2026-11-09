"use client";

import type { AdminLocation, AdminMarketplace, Locality } from "@hagz/contracts";
import { useMemo, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { ChoiceCard, ChooserDialog, ChooserSection } from "@/admin/chooser";
import { send } from "@/admin/errors";
import { Field, SelectField } from "@/admin/field";
import { countries, kindOrder } from "./countries";
import { KindIcon } from "./kind-icon";
import { useSubmit } from "./forms";
import { localityLabel } from "./model";

// Add location, in two steps: pick what kind of place it is from cards (one per kind this
// marketplace is divided into, each saying what that kind is), then say where it sits and name
// it. Opened from a row's menu, the parent is fixed and only finer kinds are offered.

const rank = (kind: Locality) => kindOrder.indexOf(kind);
// The "Inside" value for the top of the tree ("" means nothing picked yet).
const TOP = "top";
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

// What each kind of place is, on its card. The same wherever the modal was opened from.
const kindDescription: Record<Locality, string> = {
  REGION: "One of the country's main divisions, at the top of the tree.",
  EMIRATE: "One of the emirates, at the top of the tree.",
  GOVERNORATE: "One of the country's main divisions, with its cities and districts inside.",
  MUNICIPALITY: "One of the country's municipalities, at the top of the tree.",
  WILAYAT: "A province inside a governorate, with its own towns and areas.",
  CITY: "A city or new town, usually inside a governorate.",
  DISTRICT: "A part of a city or governorate that people search by.",
  AREA: "A smaller part of a district, for more precise searches.",
  NEIGHBORHOOD: "The smallest level: a block, compound or street area.",
};

export function AddLocationDialog({
  marketplace,
  locations,
  parent,
  onClose,
  onDone,
}: {
  marketplace: AdminMarketplace;
  // Every location in the marketplace, for the examples and the parent list.
  locations: AdminLocation[];
  // Fixed when opened from a row's "Add location under".
  parent?: AdminLocation | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<Locality>();

  // The country's divisions plus any kind already used here, coarsest first; under a fixed parent,
  // only what's finer than it.
  const kinds = useMemo(() => {
    const country = countries.find((option) => option.code === marketplace.code);
    const used = new Set<Locality>([
      ...(country?.kinds ?? kindOrder),
      ...locations.map((location) => location.locality),
    ]);
    return kindOrder.filter(
      (option) => used.has(option) && (!parent || rank(option) > rank(parent.locality)),
    );
  }, [marketplace.code, locations, parent]);

  const frame = { onClose, onBack: () => setKind(undefined) };

  if (!kind) {
    return (
      <ChooserDialog
        onClose={onClose}
        title="Add location"
        description={
          parent
            ? `It goes inside ${parent.names.en}.`
            : `In ${marketplace.names.en}: top-level places first, then the ones inside them.`
        }
      >
        <ChooserSection columns={2}>
          {kinds.map((option) => (
            <ChoiceCard
              key={option}
              // The icon in its own circle above the name, like the reference's top cards.
              icon={<KindIcon kind={option} />}
              title={localityLabel[option]}
              description={kindDescription[option]}
              onSelect={() => setKind(option)}
            />
          ))}
        </ChooserSection>
      </ChooserDialog>
    );
  }

  return (
    <Details
      frame={frame}
      marketplace={marketplace}
      locations={locations}
      parent={parent}
      kind={kind}
      topLevel={!parent && kind === kinds[0]}
      onDone={onDone}
    />
  );
}

function Details({
  frame,
  marketplace,
  locations,
  parent,
  kind,
  topLevel,
  onDone,
}: {
  frame: { onClose: () => void; onBack: () => void };
  marketplace: AdminMarketplace;
  locations: AdminLocation[];
  parent?: AdminLocation | null;
  kind: Locality;
  // The coarsest kind: starts at the top of the tree rather than inside something.
  topLevel: boolean;
  onDone: () => void;
}) {
  // Where it can go: the top, or inside anything coarser than it, labelled by its full path.
  const options = useMemo(() => {
    const byId = new Map(locations.map((location) => [location.id, location]));
    const path = (location: AdminLocation): string => {
      const above = location.parentId ? byId.get(location.parentId) : undefined;
      return above ? `${path(above)} › ${location.names.en}` : location.names.en;
    };
    const inside = locations
      .filter((location) => rank(location.locality) < rank(kind))
      .map((location) => ({ value: location.id, label: path(location) }))
      .sort((a, b) => a.label.localeCompare(b.label, "en"));
    return [{ value: TOP, label: `Top level of ${marketplace.names.en}` }, ...inside];
  }, [locations, kind, marketplace.names.en]);

  const [form, setForm] = useState({
    // Nothing picked until the admin picks it: a default would quietly file it in the first one.
    parentId: parent?.id ?? (topLevel ? TOP : ""),
    en: "",
    ar: "",
  });
  const { busy, error, run } = useSubmit(onDone, frame.onClose);
  const label = localityLabel[kind].toLowerCase();
  // Like the sign-in page: the button stays grey until both names are there.
  const ready = form.parentId !== "" && form.en.trim() !== "" && form.ar.trim() !== "";

  const submit = () =>
    ready &&
    void run(() =>
      send(
        api.POST("/v1/admin/marketplaces/{id}/locations", {
          params: { path: { id: marketplace.id } },
          body: {
            parentId: form.parentId === TOP ? null : form.parentId,
            locality: kind,
            names: { en: form.en.trim(), ar: form.ar.trim() },
          },
        }),
      ),
    );

  return (
    <ChooserDialog
      {...frame}
      title={
        <>
          <KindIcon kind={kind} size="1.25rem" />
          Add {article(label)} {label}
        </>
      }
      description={
        parent
          ? `Inside ${parent.names.en}, ${marketplace.names.en}`
          : topLevel
            ? `At the top level of ${marketplace.names.en}`
            : `In ${marketplace.names.en}`
      }
      footer={
        <>
          <Button variant="secondary" size="small" onClick={frame.onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-location" size="small" loading={busy} disabled={!ready}>
            Add {label}
          </Button>
        </>
      }
    >
      <form
        id="add-location"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-4">
          {/* Fixed by the row it was opened from, or the top level for the coarsest kind. */}
          {parent || topLevel ? null : (
            <SelectField
              label="Inside"
              placeholder={`Choose where this ${label} sits`}
              options={options}
              value={form.parentId}
              onChange={(event) => setForm({ ...form, parentId: event.target.value })}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="English name"
              hint="Also makes the slug in URLs."
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
