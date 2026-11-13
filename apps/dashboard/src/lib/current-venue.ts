import { useQuery } from "@tanstack/react-query";
import { queries } from "./queries";
import { runningVenues } from "./venues";

// The venue the tabs are showing. For now the first running venue the staff member belongs to; the
// switcher (a long press on the Venue tab) and remembering the last one opened come next. A venue
// still being set up isn't one of them: it has nothing to run yet.
export const useCurrentVenue = () => {
  const venues = useQuery(queries.venues);
  return { venue: runningVenues(venues.data)[0], venues };
};
