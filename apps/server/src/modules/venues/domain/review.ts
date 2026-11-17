import type { SetupItemKey } from "@hagz/contracts";
import {
  GROUND_ADDED,
  GROUND_CHANGED,
  GROUND_REMOVED,
  GROUND_SCHEDULE_CHANGED,
  GROUND_SCHEDULE_COPIED,
  GROUNDS_REORDERED,
  VENUE_AMENITIES_CHANGED,
  VENUE_DETAILS_CHANGED,
  VENUE_LAYOUT_CHANGED,
  VENUE_LOCATION_CHANGED,
  VENUE_PHOTO_ADDED,
  VENUE_PHOTO_REMOVED,
  VENUE_PHOTOS_REORDERED,
  VENUE_SETTINGS_CHANGED,
  VENUE_TRANSLATION_CHANGED,
} from "./events";

// What going live needs (docs/onboarding.md, step 3): the listing in Arabic and English, and a
// ground players can book. Slot generation (PR 2.6) will add "every ground generated" here.

export type GoLiveGap = "AR_TRANSLATION" | "EN_TRANSLATION" | "ACTIVE_GROUND";

const complete = (t: { name: string; description: string | null; address: string | null }) =>
  [t.name, t.description, t.address].every((text) => text !== null && text.trim().length > 0);

export const goLiveGaps = (
  translations: {
    language: "AR" | "EN";
    name: string;
    description: string | null;
    address: string | null;
  }[],
  activeGrounds: number,
): GoLiveGap[] => {
  const gaps: GoLiveGap[] = [];
  for (const language of ["AR", "EN"] as const) {
    const translation = translations.find((t) => t.language === language);
    if (!translation || !complete(translation)) gaps.push(`${language}_TRANSLATION`);
  }
  if (activeGrounds === 0) gaps.push("ACTIVE_GROUND");
  return gaps;
};

// Sending a venue back with the sections to change (docs/onboarding.md, step 3): a section counts as
// changed once the owner's side records an edit to it after the send-back. Edits that change nothing
// record nothing, so saving as it was doesn't count. Changed, not necessarily fixed: the next review
// judges that.

interface Edit {
  type: string;
  data: unknown;
}

// Which fields a VENUE_DETAILS_CHANGED event changed: it covers the phone (part of Details) and the
// tax number (a section of its own).
const detailFields = (data: unknown) =>
  Object.keys((data as { changes?: Record<string, unknown> } | null)?.changes ?? {});

const CHANGES: Record<SetupItemKey, (edit: Edit) => boolean> = {
  DETAILS: (edit) =>
    edit.type === VENUE_TRANSLATION_CHANGED ||
    (edit.type === VENUE_DETAILS_CHANGED && detailFields(edit.data).includes("phone")),
  LOCATION: (edit) => edit.type === VENUE_LOCATION_CHANGED,
  PHOTOS: (edit) =>
    [VENUE_PHOTO_ADDED, VENUE_PHOTO_REMOVED, VENUE_PHOTOS_REORDERED].includes(edit.type),
  GROUNDS: (edit) =>
    [GROUND_ADDED, GROUND_CHANGED, GROUND_REMOVED, GROUNDS_REORDERED].includes(edit.type),
  SCHEDULES: (edit) => [GROUND_SCHEDULE_CHANGED, GROUND_SCHEDULE_COPIED].includes(edit.type),
  LAYOUT: (edit) => edit.type === VENUE_LAYOUT_CHANGED,
  SETTINGS: (edit) => edit.type === VENUE_SETTINGS_CHANGED,
  AMENITIES: (edit) => edit.type === VENUE_AMENITIES_CHANGED,
  TAX_NUMBER: (edit) =>
    edit.type === VENUE_DETAILS_CHANGED && detailFields(edit.data).includes("taxNumber"),
};

// Every event type that can change a section, to fetch only those.
export const SECTION_EDIT_EVENTS = [
  VENUE_TRANSLATION_CHANGED,
  VENUE_DETAILS_CHANGED,
  VENUE_LOCATION_CHANGED,
  VENUE_PHOTO_ADDED,
  VENUE_PHOTO_REMOVED,
  VENUE_PHOTOS_REORDERED,
  GROUND_ADDED,
  GROUND_CHANGED,
  GROUND_REMOVED,
  GROUNDS_REORDERED,
  GROUND_SCHEDULE_CHANGED,
  GROUND_SCHEDULE_COPIED,
  VENUE_LAYOUT_CHANGED,
  VENUE_SETTINGS_CHANGED,
  VENUE_AMENITIES_CHANGED,
];

// The sections a send-back asked to change that no edit since has touched.
export const unchangedSections = (asked: SetupItemKey[], editsSince: Edit[]): SetupItemKey[] =>
  asked.filter((key) => !editsSince.some(CHANGES[key]));
