import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/screen";
import { useInvitationSheet } from "@/components/use-invitation-sheet";
import { queries } from "@/lib/queries";

// The venue's Home tab, blank until "Today" is built. An invitation link opened while on a venue's
// team opens here, in the same sheet as on first run.
export default function VenueHome() {
  const me = useQuery(queries.me);
  const invitation = useInvitationSheet({
    phone: me.data?.phone.replace(/^\+20/, ""),
    takeLinks: me.data !== undefined,
  });

  return <Screen tabbed>{invitation.sheet}</Screen>;
}
