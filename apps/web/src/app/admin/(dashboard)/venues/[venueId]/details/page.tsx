"use client";

import type { VenueTranslation } from "@hagz/contracts";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Skeleton } from "@/admin/data-table";
import { canTranslate, LANGUAGES } from "@/admin/venues/detail-sections";
import { useVenueTranslations } from "@/admin/venues/translations";
import { TranslationsPanel } from "@/admin/venues/translations-panel";
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's name, description and address, the section its Details opens on: one row per field with
// English and Arabic beside each other, so a missing or mistranslated line shows against the other
// language (Figma A6, option 5, with option 3's columns). Edit opens both languages in a side panel.

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
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-heading font-semibold text-ink">Name and description</h2>
          <p className="mt-1 text-body text-ink-2">
            {venue && !editable
              ? "The owner’s words. Hagz can edit them once the venue is approved."
              : "What players read, in English and Arabic."}
          </p>
        </div>
        {editable && data ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1.5 shrink-0 cursor-pointer text-label font-semibold text-ink underline underline-offset-4 hover:opacity-70"
          >
            Edit
          </button>
        ) : null}
      </div>

      <div className="mt-8">
        {/* The languages, over their columns. */}
        <div className="grid grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-10 border-b border-border pb-3 text-label font-semibold text-ink">
          <span />
          {LANGUAGES.map(({ language, label }) => (
            <span key={language} className={language === "AR" ? "text-right" : undefined}>
              {label}
            </span>
          ))}
        </div>
        {error && !data ? (
          <p className="py-6 text-body text-ink-2">{error}</p>
        ) : (
          FIELDS.map(({ field, label }) => (
            <div
              key={field}
              className="grid grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-10 border-b border-border py-4"
            >
              <span className="text-label text-ink-2">{label}</span>
              {LANGUAGES.map(({ language }) => (
                <Value key={language} translations={data} language={language} field={field} />
              ))}
            </div>
          ))
        )}
      </div>

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
