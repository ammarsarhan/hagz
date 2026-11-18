import type { VenueStatus } from "@hagz/contracts";
import {
  IconAdjustments,
  IconCalendarEvent,
  IconCash,
  IconClockHour4,
  IconClipboardCheck,
  IconHistory,
  IconInfoCircle,
  IconSoccerField,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

// A venue's admin dashboard (/admin/venues/[venueId]/…), one page per section, each filled in by
// the phase that builds it (docs/plan.md). `slug` is the path under the venue. There's no overview:
// the application is a workflow that ends, so it has its own tab only until the venue is live, and
// what the venue has once it runs (bookings, money) only shows from then on (user, 2026-11-17).

export interface VenueSection {
  slug: string;
  label: string;
  icon: Icon;
  phase: string;
  description: string;
  // When it's shown: only while the venue is applying, only once it's live, or always.
  when: "applying" | "live" | "always";
}

// Applying: a draft the owner is setting up, waiting for review, or being provisioned. Live
// includes paused (MAINTENANCE): its bookings and money are still there.
export const isApplying = (status: VenueStatus) =>
  status === "DRAFT" || status === "SUBMITTED" || status === "PROVISIONING";

export const venueSections: VenueSection[] = [
  {
    slug: "application",
    label: "Application",
    icon: IconClipboardCheck,
    phase: "Phase 2",
    when: "applying",
    description:
      "The way to live: the owner's checklist, the review (approve, or send back with a reason), then what going live needs.",
  },
  {
    slug: "details",
    label: "Details",
    icon: IconInfoCircle,
    phase: "Phase 2",
    when: "always",
    description:
      "What players see: name, description and address in Arabic and English, the pin and area, photos and amenities. Plus the tax number.",
  },
  {
    slug: "grounds",
    label: "Grounds",
    icon: IconSoccerField,
    phase: "Phase 2",
    when: "always",
    description:
      "Each ground with its prices and schedule: generated until, the last run, stale or drifted slots, and Regenerate.",
  },
  {
    slug: "slots",
    label: "Slots",
    icon: IconClockHour4,
    phase: "Phase 2",
    when: "always",
    description:
      "The bookable hours generated from each ground's schedule, a day at a time: price, tier and whether they're free, held, booked or blocked.",
  },
  {
    slug: "bookings",
    label: "Bookings",
    icon: IconCalendarEvent,
    phase: "Phase 4",
    when: "live",
    description: "The venue's bookings by day and ground, with their payments and cancellations.",
  },
  {
    slug: "team",
    label: "Team",
    icon: IconUsers,
    phase: "Phase 2",
    when: "always",
    description:
      "The owner, members and their permissions, open invitations, and transferring ownership.",
  },
  {
    slug: "finance",
    label: "Finance",
    icon: IconCash,
    phase: "Phase 6",
    when: "live",
    description:
      "Money collected and refunded, commission, the balance, payout destinations and payouts.",
  },
  {
    slug: "settings",
    label: "Settings",
    icon: IconAdjustments,
    phase: "Phase 2",
    when: "always",
    description:
      "How Hagz runs it: pausing and resuming bookings, the commission override and the cancellation policy.",
  },
  {
    slug: "history",
    label: "History",
    icon: IconHistory,
    phase: "Phase 2",
    when: "always",
    description:
      "Every change to the venue with its previous and new values, who made it, and Revert.",
  },
];

// The tabs a venue in this status has, in order.
export const visibleSections = (status: VenueStatus) =>
  venueSections.filter(
    (section) => section.when === "always" || (section.when === "applying") === isApplying(status),
  );

// Where a venue opens: its application while it's applying, its bookings once it's live.
export const defaultSlug = (status: VenueStatus) =>
  isApplying(status) ? "application" : "bookings";

export const venueHref = (venueId: string, slug = "") =>
  `/admin/venues/${venueId}${slug ? `/${slug}` : ""}`;
