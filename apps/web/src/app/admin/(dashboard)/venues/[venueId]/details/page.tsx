"use client";

import type { VenueTranslation } from "@hagz/contracts";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Skeleton } from "@/admin/data-table";
import { canTranslate, LANGUAGES } from "@/admin/venues/detail-sections";
import { useVenueTranslations } from "@/admin/venues/translations";
import { TranslationsPanel } from "@/admin/venues/translations-panel";
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's name, description and address, the section its Details opens on, as in the design
// (Figma A6, option 5): an English block, then an Arabic one, each a heading over a row per field.
// Either block's Edit opens both languages in one side panel.

const FIELDS = [
  { field: "name", label: "Name" },
  { field: "description", label: "Description" },
  { field: "address", label: "Address" },
] as const;

export default function VenueText() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload: reloadVenue } = useCurrentVenue();
  const { data, error, reload } = useVenueTranslations(venueId);
  const [editing, setEditing] = useState(false);
  const editable = venue ? canTranslate(venue.status) : false;

  return (
    <section>
      <h2 className="text-heading font-semibold text-ink">Name and description</h2>
      <p className="mt-1 text-body text-ink-2">
        {venue && !editable
          ? "The owner’s words. Hagz can edit them once the venue is approved."
          : "What players read, in both languages. Arabic is shown right to left, as players see it."}
      </p>

      {error && !data ? (
        <p className="mt-8 text-body text-ink-2">{error}</p>
      ) : (
        LANGUAGES.map(({ language, label }) => (
          <div key={language} className="mt-8">
            <div className="flex items-center justify-between gap-6 border-b border-border pb-3">
              <h3 className="text-body font-semibold text-ink">{label}</h3>
              {editable && data ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="shrink-0 cursor-pointer text-label font-semibold text-ink underline underline-offset-4 hover:opacity-70"
                >
                  Edit
                </button>
              ) : null}
            </div>
            {FIELDS.map(({ field, label: fieldLabel }) => (
              <div
                key={field}
                className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-x-6 border-b border-border py-4"
              >
                <span className="text-label text-ink-2">{fieldLabel}</span>
                <Value translations={data} language={language} field={field} />
              </div>
            ))}
          </div>
        ))
      )}

      {editing && data ? (
        <TranslationsPanel
          venueId={venueId}
          translations={data}
          onClose={() => setEditing(false)}
          onDone={() => {
            reload();
            // The header shows the English name.
            reloadVenue();
          }}
        />
      ) : null}
    </section>
  );
}

function Value({
  translations,
  language,
  field,
}: {
  translations?: VenueTranslation[];
  language: "EN" | "AR";
  field: "name" | "description" | "address";
}) {
  const arabic = language === "AR";
  if (!translations) return <Skeleton className={`h-4 w-3/4 ${arabic ? "ml-auto" : ""}`} />;
  const text = translations.find((t) => t.language === language)?.[field]?.trim();
  return text ? (
    <p
      dir={arabic ? "rtl" : undefined}
      lang={arabic ? "ar" : undefined}
      className="text-body whitespace-pre-line text-ink"
    >
      {text}
    </p>
  ) : (
    <span className={`text-body text-ink-3 ${arabic ? "text-right" : ""}`}>None</span>
  );
}
