import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { useInvitationSheet } from "@/components/use-invitation-sheet";
import { useCurrentVenue } from "@/lib/current-venue";
import { queries } from "@/lib/queries";

// The venue's Home tab: "Today" comes next. An invitation link opened while on a venue's team opens
// here, in the same sheet as on first run.
export default function VenueHome() {
  const { t } = useTranslation();
  const { venue } = useCurrentVenue();
  const me = useQuery(queries.me);
  const invitation = useInvitationSheet({
    phone: me.data?.phone.replace(/^\+20/, ""),
    takeLinks: me.data !== undefined,
  });

  return (
    <Screen tabbed>
      <Title subtitle={t("screens.venueHome.subtitle")}>{venue?.name ?? ""}</Title>
      {invitation.sheet}
    </Screen>
  );
}
