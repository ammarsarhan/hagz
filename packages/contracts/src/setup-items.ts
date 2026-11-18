import { z } from "zod";

// The sections of a venue's setup checklist (docs/onboarding.md, "Step 2"). On its own so both the
// checklist (venue-setup.ts) and sending a venue back with the sections to change (review.ts) can use
// it without importing each other. LAYOUT only appears for venues with two or more active grounds.
export const SetupItemKey = z
  .enum([
    "DETAILS",
    "LOCATION",
    "PHOTOS",
    "GROUNDS",
    "SCHEDULES",
    "LAYOUT",
    "SETTINGS",
    "AMENITIES",
    "TAX_NUMBER",
  ])
  .meta({ id: "SetupItemKey" });

export type SetupItemKey = z.infer<typeof SetupItemKey>;
