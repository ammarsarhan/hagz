import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { send } from "./api-errors";

// The answer, or the failure thrown, which is how TanStack Query expects a query to fail. The error
// is the same problem (or network failure) `send` gives screens, so the messages don't change.
const fetched = async <T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> => {
  const result = await send(request);
  if (!result.ok) throw result.error;
  return result.data;
};

// The signed-in staff member's reads, shared by every screen that shows them. Keys sit under
// "staff" so a write can invalidate one, or the whole lot.
export const queries = {
  me: queryOptions({
    queryKey: ["staff", "me"],
    queryFn: () => fetched(api.GET("/v1/staff/me")),
  }),
  venues: queryOptions({
    queryKey: ["staff", "venues"],
    queryFn: async () => (await fetched(api.GET("/v1/staff/venues"))).data,
  }),
  invitations: queryOptions({
    queryKey: ["staff", "invitations"],
    queryFn: async () => (await fetched(api.GET("/v1/staff/invitations"))).data,
  }),
};
