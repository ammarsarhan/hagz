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

// Plain data, without "use client": the Details pages that aren't built yet are server components,
// and a server component importing from a client module gets references, not these values.

// A venue's Details tab: what players see, split into sections by a menu beside them (Figma A6,
// option 5, user 2026-11-17). Translating is what admins edit most in this phase, so the tab opens
// on the name and description, in English and Arabic side by side.

export interface DetailSection {
  // The page under Details; "" is Details itself.
  slug: string;
  label: string;
  icon: Icon;
  description: string;
}

export const detailSections: DetailSection[] = [
  {
    slug: "",
    label: "Translations",
    icon: IconAlignLeft,
    description: "What players read, in English and Arabic.",
  },
  {
    slug: "photos",
    label: "Photos",
    icon: IconPhoto,
    description: "The venue's photos in the order players see them, the cover first.",
  },
  {
    slug: "location",
    label: "Location",
    icon: IconMapPin,
    description: "The pin on the map and the area players find the venue under.",
  },
  {
    slug: "amenities",
    label: "Amenities",
    icon: IconStar,
    description: "What the venue offers, and what each costs when it isn't free.",
  },
  {
    slug: "contact",
    label: "Contact and tax",
    icon: IconPhone,
    description: "The phone number players call and the tax number with its latest check.",
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
