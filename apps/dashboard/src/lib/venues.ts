import type { components } from "@hagz/api";

type StaffVenue = components["schemas"]["StaffVenue"];
type VenueStatus = components["schemas"]["VenueStatus"];

// A venue is either being set up or being run, and the two live in different parts of the app.
//
// Running (live, or paused for maintenance) means there are bookings, money and a calendar: that's
// the venue tabs. Unfinished (a draft, one sent for review, one being provisioned) has none of
// that, so it never appears in the tabs, the switcher or Home — it's reached through its own setup
// flow instead (docs/flows.md, "draft venues").
const RUNNING: VenueStatus[] = ["LIVE", "MAINTENANCE"];

export const isRunning = (venue: StaffVenue) => RUNNING.includes(venue.status);

export const runningVenues = (venues: StaffVenue[] = []) => venues.filter(isRunning);

// The one venue a staff member can be setting up (the API allows no more than one unfinished venue
// they own), or undefined.
export const unfinishedVenue = (venues: StaffVenue[] = []) =>
  venues.find((venue) => !isRunning(venue));
