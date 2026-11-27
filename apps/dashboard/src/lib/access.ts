import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentVenue } from "./current-venue";
import { queries } from "./queries";
import type { Area, Level, Permissions } from "./team";

// What a screen needs of the member's access at its venue (staff permissions: 7 areas × none, view,
// manage; owners manage everything, as the API sends it). The API refuses anything beyond it anyway;
// these keep the app from showing what would only be refused. One list, so a screen's guard and the
// rows and buttons that open it never disagree.
type One = { area: Area; level: Exclude<Level, "none"> };
// Or either of two areas (the Calendar: bookings or closing hours).
export type Rule = One | { any: readonly One[] };

const RANK: Record<Level, number> = { none: 0, view: 1, manage: 2 };

export const allows = (permissions: Permissions | undefined, rule: Rule): boolean => {
  if (!permissions) return false;
  if ("any" in rule) return rule.any.some((one) => allows(permissions, one));
  return RANK[permissions[rule.area]] >= RANK[rule.level];
};

const view = (area: Area): One => ({ area, level: "view" });
const manage = (area: Area): One => ({ area, level: "manage" });

// By screen. "view" screens show read-only for view and let manage change things; "manage" screens
// are forms with nothing to show without changing it.
export const RULES = {
  calendar: { any: [view("bookings"), view("schedule")] },
  payments: { any: [view("payments"), view("finance")] },
  time: { any: [view("bookings"), view("schedule")] },
  requests: view("bookings"),
  booking: view("bookings"),
  bookingChange: manage("bookings"),
  book: manage("bookings"),
  closeTime: manage("schedule"),
  regulars: view("bookings"),
  regularNew: manage("bookings"),
  customers: view("customers"),
  team: view("staff"),
  invite: manage("staff"),
  // Setup's screens edit a live venue as they did the draft.
  venueForm: manage("venue"),
  bookingSettings: view("venue"),
  scheduleForm: manage("schedule"),
} as const satisfies Record<string, Rule>;

// The permissions to judge by: setup's screens are for the venue in their path (a draft, or a live
// one opened from the Venue tab); every other screen is the current venue's. `undefined` while the
// venues are still being read.
export const usePermissions = (): { permissions: Permissions | undefined; ready: boolean } => {
  const { venueId } = useLocalSearchParams<{ venueId?: string }>();
  const { venue, ready } = useCurrentVenue();
  const venues = useQuery(queries.venues);
  if (venueId) {
    const own = venues.data?.find((one) => one.id === venueId);
    return { permissions: own?.permissions, ready: venues.isSuccess };
  }
  return { permissions: venue?.permissions, ready };
};

export const useCan = () => {
  const { permissions } = usePermissions();
  return (rule: Rule) => allows(permissions, rule);
};
