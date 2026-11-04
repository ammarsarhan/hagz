import { useQuery } from "@tanstack/react-query";
import { queries } from "./queries";

// The venue the tabs are showing. For now the first the staff member belongs to; the switcher (a
// long press on the Venue tab) and remembering the last one opened come next.
export const useCurrentVenue = () => {
  const venues = useQuery(queries.venues);
  return { venue: venues.data?.[0], venues };
};
