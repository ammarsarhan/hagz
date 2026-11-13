import type { VenueStatus } from "@hagz/contracts";

// What an owner's team can change in each status (docs/onboarding.md, "Lifecycle"; user,
// 2026-11-13). The listing is what players read and admins review: name, description, address,
// location and photos. Operations are grounds, hours, prices, layout, settings and amenities.
export type EditPart = "listing" | "operations";

export const editable = (status: VenueStatus, part: EditPart): boolean => {
  // In review, nothing changes until an admin decides; the owner withdraws to edit.
  if (status === "SUBMITTED") return false;
  // Approved: admins finish the listing while the owner prepares to open.
  if (status === "PROVISIONING") return part === "operations";
  return true;
};

export const lockedDetail = (status: VenueStatus) =>
  status === "SUBMITTED"
    ? "The venue is in review. Withdraw it to make changes."
    : "The listing is being finished by Hagz. You can change grounds, hours and settings.";
