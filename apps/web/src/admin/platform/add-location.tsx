"use client";

import type { AdminLocation, AdminMarketplace, Locality } from "@hagz/contracts";
import {
  IconBuildingCastle,
  IconBuildingCommunity,
  IconBuildingSkyscraper,
  IconHome,
  IconLayoutGrid,
  IconMap,
  IconMap2,
  IconMapPin,
  IconMapPins,
  type Icon,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { ChoiceCard, ChooserDialog, ChooserSection } from "@/admin/chooser";
import { send } from "@/admin/errors";
import { Field, SelectField } from "@/admin/field";
import { countries, kindOrder } from "./countries";
import { useSubmit } from "./forms";
import { byName, localityLabel } from "./model";

// Add location, in two steps: pick what kind of place it is from cards (one per kind this
// marketplace is divided into, each with real examples from its locations), then say where it
// sits and name it. Opened from a row's menu, the parent is fixed and only finer kinds are offered.

const kindIcon: Record<Locality, Icon> = {
  REGION: IconMap,
  EMIRATE: IconBuildingCastle,
  GOVERNORATE: IconMap2,
  MUNICIPALITY: IconBuildingCommunity,
  WILAYAT: IconMapPins,
  CITY: IconBuildingSkyscraper,
  DISTRICT: IconLayoutGrid,
  AREA: IconMapPin,
  NEIGHBORHOOD: IconHome,
};

const rank = (kind: Locality) => kindOrder.indexOf(kind);
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

// "27 so far, like Alexandria and Aswan", or "None yet".
const examples = (of: AdminLocation[]) => {
  if (of.length === 0) return "None yet";
  const names = [...of].sort(byName).map((location) => location.names.en);
  const like = names.length === 1 ? names[0] : `${names[0]} and ${names[1]}`;
  return `${of.length.toLocaleString("en")} so far, like ${like}`;
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

  // Where this kind sits, from where the existing ones actually are ("Inside a governorate or
  // city"); with none yet, inside the kind above it in the country's list.
  const roleOf = (option: Locality, index: number) => {
    const byId = new Map(locations.map((location) => [location.id, location]));
    const containers = new Set<Locality | "TOP">();
    for (const location of locations) {
      if (location.locality !== option) continue;
      const above = location.parentId ? byId.get(location.parentId) : undefined;
      containers.add(above ? above.locality : "TOP");
    }
    if (containers.size === 0) {
      const above = kinds[index - 1];
      if (!above) return "Top level";
      const word = localityLabel[above].toLowerCase();
      return `Inside ${article(word)} ${word}`;
    }
    if (containers.has("TOP") && containers.size === 1) return "Top level";
    const words = kindOrder
      .filter((kind) => containers.has(kind))
      .map((kind) => localityLabel[kind].toLowerCase());
    const list =
      words.length === 1 ? words[0]! : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
    return `${containers.has("TOP") ? "Top level, or inside" : "Inside"} ${article(list)} ${list}`;
  };

  const where = parent ? `in ${parent.names.en}` : `in ${marketplace.names.en}`;

  if (!kind) {
    return (
      <ChooserDialog onClose={onClose} title={`Add location ${where}`}>
        <ChooserSection
          title="What are you adding?"
          description={
            parent
              ? `It goes inside ${parent.names.en}.`
              : "Top-level places first, then the ones inside them."
          }
        >
          {kinds.map((option, index) => {
            const Item = kindIcon[option];
            const role = parent ? `Inside ${parent.names.en}` : roleOf(option, index);
            return (
              <ChoiceCard
                key={option}
                icon={<Item size={16} className="size-4" stroke={1.75} />}
                title={localityLabel[option]}
                description={
                  <>
                    {role}
                    <br />
                    <span className="text-ink-3">
                      {examples(locations.filter((location) => location.locality === option))}
                    </span>
                  </>
                }
                onSelect={() => setKind(option)}
              />
            );
          })}
        </ChooserSection>
      </ChooserDialog>
    );
  }

  return (
    <Details
      marketplace={marketplace}
      locations={locations}
      parent={parent}
      kind={kind}
      topLevel={!parent && kind === kinds[0]}
      onBack={() => setKind(undefined)}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function Details({
  marketplace,
  locations,
  parent,
  kind,
  topLevel,
  onBack,
  onClose,
  onDone,
}: {
  marketplace: AdminMarketplace;
  locations: AdminLocation[];
  parent?: AdminLocation | null;
  kind: Locality;
  // The coarsest kind: starts at the top of the tree rather than inside something.
  topLevel: boolean;
  onBack: () => void;
  onClose: () => void;
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
    return [{ value: "", label: `Top level of ${marketplace.names.en}` }, ...inside];
  }, [locations, kind, marketplace.names.en]);

  const [form, setForm] = useState({
    parentId: parent?.id ?? (topLevel ? "" : (options[1]?.value ?? "")),
    en: "",
    ar: "",
  });
  const { busy, error, run } = useSubmit(onDone, onClose);
  const label = localityLabel[kind].toLowerCase();

  const submit = () =>
    void run(
      send(
        api.POST("/v1/admin/marketplaces/{id}/locations", {
          params: { path: { id: marketplace.id } },
          body: {
            parentId: form.parentId || null,
            locality: kind,
            names: { en: form.en.trim(), ar: form.ar.trim() },
          },
        }),
      ),
    );

  const Item = kindIcon[kind];
  return (
    <ChooserDialog
      onClose={onClose}
      onBack={onBack}
      title={
        <>
          <span className="flex size-7 items-center justify-center rounded-full bg-chip">
            <Item size={15} className="size-[0.9375rem]" stroke={1.75} />
          </span>
          Add {article(label)} {label}
          {parent ? ` in ${parent.names.en}` : ""}
        </>
      }
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-location" size="small" loading={busy}>
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
        <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-4">
          {parent ? null : (
            <SelectField
              label="Inside"
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
