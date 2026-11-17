"use client";

import type { Language, VenueTranslation } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { send } from "@/admin/errors";
import { Field, TextAreaField } from "@/admin/field";
import { PanelSection, SidePanel } from "@/admin/side-panel";
import { useSubmit } from "@/admin/submit";
import { LANGUAGES } from "./detail-sections";

// Editing a venue's name, description and address in both languages at once, in a side panel over
// its Details. Every field is needed for the venue to be live, so every label has the asterisk and
// Save stays grey until both languages are filled in. Only a language that changed is sent.

// The API's limits (VenueTranslationInput).
const LIMITS = { name: { min: 2, max: 60 }, description: 600, address: 200 } as const;

type Texts = { name: string; description: string; address: string };

const textsOf = (translations: VenueTranslation[], language: Language): Texts => {
  const translation = translations.find((t) => t.language === language);
  return {
    name: translation?.name ?? "",
    description: translation?.description ?? "",
    address: translation?.address ?? "",
  };
};

const complete = (texts: Texts) =>
  texts.name.trim().length >= LIMITS.name.min &&
  texts.description.trim() !== "" &&
  texts.address.trim() !== "";

const same = (a: Texts, b: Texts) =>
  a.name.trim() === b.name.trim() &&
  a.description.trim() === b.description.trim() &&
  a.address.trim() === b.address.trim();

export function TranslationsPanel({
  venueId,
  translations,
  onClose,
  onDone,
}: {
  venueId: string;
  translations: VenueTranslation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const initial = { EN: textsOf(translations, "EN"), AR: textsOf(translations, "AR") };
  const [form, setForm] = useState(initial);
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, run } = useSubmit(onDone, hide);

  const set = (language: Language, field: keyof Texts) => (event: { target: { value: string } }) =>
    setForm({ ...form, [language]: { ...form[language], [field]: event.target.value } });

  const changed = LANGUAGES.filter(({ language }) => !same(form[language], initial[language]));
  // Save stays grey until something changed and both languages are complete.
  const ready = changed.length > 0 && complete(form.EN) && complete(form.AR);

  const submit = () => {
    if (!ready) return;
    void run(async () => {
      // One language at a time; the first that's refused stops it, and the panel stays open.
      for (const { language } of changed) {
        const texts = form[language];
        const result = await send(
          api.PUT("/v1/admin/venues/{id}/translations/{language}", {
            params: { path: { id: venueId, language } },
            body: {
              name: texts.name.trim(),
              description: texts.description.trim(),
              address: texts.address.trim(),
            },
          }),
        );
        if (!result.ok) return result;
      }
      return { ok: true };
    });
  };

  return (
    <SidePanel
      open={open}
      onRequestClose={hide}
      onExited={onClose}
      title="Name and description"
      description="What players read. They see the language their app is in."
      footer={
        <>
          <Button variant="secondary" size="small" onClick={hide} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-translations"
            size="small"
            loading={busy}
            disabled={!ready}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-translations"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {LANGUAGES.map(({ language, label }) => {
          const arabic = language === "AR";
          const text = arabic ? { dir: "rtl", lang: "ar" } : {};
          return (
            <PanelSection key={language} title={label}>
              <Field
                label="Name"
                asterisk
                required
                minLength={LIMITS.name.min}
                maxLength={LIMITS.name.max}
                value={form[language].name}
                onChange={set(language, "name")}
                {...text}
              />
              <TextAreaField
                label="Description"
                asterisk
                required
                maxLength={LIMITS.description}
                value={form[language].description}
                onChange={set(language, "description")}
                {...text}
              />
              <Field
                label="Address"
                asterisk
                required
                maxLength={LIMITS.address}
                value={form[language].address}
                onChange={set(language, "address")}
                {...text}
              />
            </PanelSection>
          );
        })}
      </form>
    </SidePanel>
  );
}
