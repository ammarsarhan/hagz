import type { components } from "@hagz/api";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { api } from "./api";
import { displayPhone } from "./phone";
import { fetched } from "./queries";

export type Member = components["schemas"]["VenueMember"];
export type Invitation = components["schemas"]["StaffInvitation"];
export type Permissions = components["schemas"]["StaffPermissions"];
export type Area = keyof Permissions;
export type Level = Permissions[Area];

// In the order the access screens list them.
export const AREAS: readonly Area[] = [
  "bookings",
  "customers",
  "schedule",
  "payments",
  "finance",
  "staff",
  "venue",
];
export const LEVELS: readonly Level[] = ["none", "view", "manage"];
const RANK: Record<Level, number> = { none: 0, view: 1, manage: 2 };
export const above = (level: Level, ceiling: Level) => RANK[level] > RANK[ceiling];

export const membersQuery = (venueId: string) => ({
  queryKey: ["staff", "venues", venueId, "members"],
  queryFn: async () =>
    (
      await fetched(
        api.GET("/v1/staff/venues/{venueId}/members", { params: { path: { venueId } } }),
      )
    ).data,
});

export const invitationsQuery = (venueId: string) => ({
  queryKey: ["staff", "venues", venueId, "invitations"],
  queryFn: async () =>
    (
      await fetched(
        api.GET("/v1/staff/venues/{venueId}/invitations", { params: { path: { venueId } } }),
      )
    ).data,
});

// After any team change: the Team list and the Venue tab's Team row read both again.
export const afterTeamWrite = (queryClient: QueryClient, venueId: string) =>
  Promise.all(
    [membersQuery(venueId).queryKey, invitationsQuery(venueId).queryKey].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, exact: true }),
    ),
  );

// "+201001234567" → "+20 100 123 4567".
export const memberPhone = (phone: string) => displayPhone(phone.replace(/^\+20/, ""));

// "a, b and c", through i18n keys (Hermes has no Intl.ListFormat).
const listOf = (t: TFunction, items: string[]) =>
  items.length < 2
    ? (items[0] ?? "")
    : t("screens.team.and", {
        list: items.slice(0, -1).join(t("screens.team.comma")),
        last: items.at(-1),
      });

// What someone can do, in a line: "Manages bookings and customers · sees hours and prices".
export const accessLine = (t: TFunction, permissions: Permissions) => {
  const at = (level: Level) =>
    AREAS.filter((area) => permissions[area] === level).map((area) =>
      t(`screens.team.words.${area}`),
    );
  const manages = at("manage");
  const sees = at("view");
  const parts = [
    manages.length > 0 ? t("screens.team.manages", { list: listOf(t, manages) }) : null,
    sees.length > 0
      ? t(manages.length > 0 ? "screens.team.alsoSees" : "screens.team.sees", {
          list: listOf(t, sees),
        })
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : t("screens.team.noAccess");
};
