import {
  IconCalendarEvent,
  IconCash,
  IconHistory,
  IconInfoCircle,
  IconLayoutDashboard,
  IconSoccerField,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

// A venue's admin dashboard (/admin/venues/[venueId]/…), one page per section. The structure is set;
// the layout is agreed, and each section is filled in by the phase that builds it
// (docs/plan.md). `slug` is the path under the venue; the overview has none.

export interface VenueSection {
  slug: string;
  label: string;
  icon: Icon;
  phase: string;
  description: string;
}

export const venueSections: VenueSection[] = [
  {
    slug: "",
    label: "Overview",
    icon: IconLayoutDashboard,
    phase: "Phase 2",
    description:
      "Where the venue is on its way to live, with the review actions: approve, reject with a reason, go live, pause and resume.",
  },
  {
    slug: "details",
    label: "Details",
    icon: IconInfoCircle,
    phase: "Phase 2",
    description:
      "Name, description and address in Arabic and English, the pin and area, photos, amenities, the tax number and the commission override.",
  },
  {
    slug: "grounds",
    label: "Grounds",
    icon: IconSoccerField,
    phase: "Phase 2",
    description:
      "Each ground with its prices and schedule: generated until, the last run, stale or drifted slots, and Regenerate.",
  },
  {
    slug: "bookings",
    label: "Bookings",
    icon: IconCalendarEvent,
    phase: "Phase 4",
    description: "The venue's bookings by day and ground, with their payments and cancellations.",
  },
  {
    slug: "team",
    label: "Team",
    icon: IconUsers,
    phase: "Phase 2",
    description:
      "The owner, members and their permissions, open invitations, and transferring ownership.",
  },
  {
    slug: "finance",
    label: "Finance",
    icon: IconCash,
    phase: "Phase 6",
    description:
      "Money collected and refunded, commission, the balance, payout destinations and payouts.",
  },
  {
    slug: "history",
    label: "History",
    icon: IconHistory,
    phase: "Phase 2",
    description:
      "Every change to the venue with its previous and new values, who made it, and Revert.",
  },
];

export const venueHref = (venueId: string, slug = "") =>
  `/admin/venues/${venueId}${slug ? `/${slug}` : ""}`;
