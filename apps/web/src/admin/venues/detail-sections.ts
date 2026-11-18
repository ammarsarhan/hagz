import type { Language, VenueStatus } from "@hagz/contracts";
import {
  IconAlignLeft,
  IconMapPin,
  IconPhone,
  IconPhoto,
  IconStar,
  type Icon,
} from "@tabler/icons-react";
import { venueHref } from "./sections";

// Plain data, without "use client", so a server component can import it too: one importing from a
// client module gets references, not these values.

// A venue's Details tab: what players see, split into sections by a menu beside them (Figma A6,
// option 5, user 2026-11-17). Translating is what admins edit most in this phase, so the tab opens
// on the translations, the English block over the Arabic one.

export interface DetailSection {
  // The page under Details; "" is Details itself.
  slug: string;
  label: string;
  icon: Icon;
}

export const detailSections: DetailSection[] = [
  {
    slug: "",
    label: "Translations",
    icon: IconAlignLeft,
  },
  {
    slug: "photos",
    label: "Photos",
    icon: IconPhoto,
  },
  {
    slug: "location",
    label: "Location",
    icon: IconMapPin,
  },
  {
    slug: "amenities",
    label: "Amenities",
    icon: IconStar,
  },
  {
    slug: "contact",
    label: "Contact and tax",
    icon: IconPhone,
  },
];

export const detailHref = (venueId: string, slug: string) =>
  venueHref(venueId, slug ? `details/${slug}` : "details");

// Hagz writes translations once it has approved the venue; before that the listing is the owner's.
export const canTranslate = (status: VenueStatus) =>
  status === "PROVISIONING" || status === "LIVE" || status === "MAINTENANCE";

export const LANGUAGES: { language: Language; label: string }[] = [
  { language: "EN", label: "English" },
  { language: "AR", label: "Arabic" },
];
