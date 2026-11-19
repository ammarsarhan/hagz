import { useQuery, type QueryFilters } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { StartOptions } from "@/components/start-options";
import { Title } from "@/components/title";
import { useInvitationSheet } from "@/components/use-invitation-sheet";
import { useOpenInvitations } from "@/components/invitation-card";
import { colors } from "@/lib/colors";
import { queries } from "@/lib/queries";
import { useRefreshWhenShown } from "@/lib/use-refresh";
import { unfinishedVenue } from "@/lib/venues";

// Invitations can be sent or taken back from another phone while this screen is open, and the
// draft can be sent back or approved.
const REFRESHED: QueryFilters[] = [
  { queryKey: queries.venues.queryKey, exact: true },
  { queryKey: queries.invitations.queryKey, exact: true },
];

// "Join or create a venue", from the Account tab, for staff already on a venue's team: the same
// invitations, draft and start tiles as first run, under a back button. Joining goes back to the
// tabs. The draft has to be passed: without it "Create your venue" stays open and only fails at the
// end of the flow, since the API allows one unfinished venue.
export default function Join() {
  const { t } = useTranslation();
  const me = useQuery(queries.me);
  const venues = useQuery(queries.venues);
  const received = useQuery(queries.invitations);
  useRefreshWhenShown(REFRESHED);
  const phone = me.data?.phone.replace(/^\+20/, "");
  const invitation = useInvitationSheet({ phone, takeLinks: false, onJoined: () => router.back() });
  const invitations = useOpenInvitations(received.data);
  const draft = unfinishedVenue(venues.data);

  return (
    <Screen>
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      {invitations && venues.data && phone !== undefined ? (
        <>
          <Title
            subtitle={
              invitations.length > 0
                ? t("screens.join.invitedSubtitle", { count: invitations.length })
                : t("screens.join.emptySubtitle")
            }
          >
            {t("screens.join.title")}
          </Title>
          <StartOptions
            invitations={invitations}
            phone={phone}
            draft={draft}
            onOpen={invitation.open}
            onHaveCode={() => invitation.open("code")}
            onDeclined={invitation.drop}
          />
        </>
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink3} />
        </View>
      )}
      {invitation.sheet}
    </Screen>
  );
}
