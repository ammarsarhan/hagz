import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { StartOptions } from "@/components/start-options";
import { Title } from "@/components/title";
import { useInvitationSheet } from "@/components/use-invitation-sheet";
import { useOpenInvitations } from "@/components/invitation-card";
import { hudMessage } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { queries } from "@/lib/queries";
import { useRefreshWhenShown } from "@/lib/use-refresh";
import { runningVenues, unfinishedVenue } from "@/lib/venues";

// What can change on another phone while this screen is open: invitations sent or taken back, and
// the draft (its name, area, "Last updated").
const REFRESHED = [queries.venues.queryKey, queries.invitations.queryKey];

// Where signing in lands. Staff who belong to a venue go on to its tabs (venue/); staff who don't see
// first run (Figma "D2 · First run, carousel option"): their invitations as a swipeable row of blue
// cards, then the other ways to start. It fits on one screen, so the page doesn't scroll; only the
// carousel moves, and it runs to the screen edges. An invitation link opened on the way here
// (manage/invite/[code]) opens in the sheet once the page has loaded.
export default function Home() {
  const { t } = useTranslation();
  const hud = useHud();
  // Cached: coming back to this screen, or opening the account page, doesn't fetch them again. They
  // change when an invitation is answered, which updates or invalidates them.
  const me = useQuery(queries.me);
  const venues = useQuery(queries.venues);
  const received = useQuery(queries.invitations);
  useRefreshWhenShown(REFRESHED);
  const invitations = useOpenInvitations(received.data);
  const reads = [me, venues, received];
  const failure = reads.find((read) => read.isError)?.error;
  const failed = failure !== undefined && failure !== null;
  const data =
    me.data && venues.data && invitations
      ? { me: me.data, venues: venues.data, invitations }
      : null;
  // Only a venue that's running sends them to the tabs. One still being set up shows here, as the
  // card that carries on where they left off (docs/flows.md, "draft venues").
  const hasVenue = runningVenues(data?.venues).length > 0;
  const draft = unfinishedVenue(data?.venues);
  // Links wait for the page to load, and are left for the venue's home when that's where this goes.
  const invitation = useInvitationSheet({
    phone: data?.me.phone.replace(/^\+20/, ""),
    takeLinks: data !== null && !hasVenue,
  });

  useEffect(() => {
    if (failed) hud.show(hudMessage(failure));
  }, [failed, failure, hud]);

  const retry = () => {
    for (const read of reads) if (read.isError) void read.refetch();
  };

  if (!data) {
    return (
      <Screen
        footer={failed ? <Button label={t("screens.firstRun.retry")} onPress={retry} /> : undefined}
      >
        {failed ? null : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.ink3} />
          </View>
        )}
      </Screen>
    );
  }

  // On a venue's team (just joined, too): its tabs.
  if (hasVenue) return <Redirect href="/venue" />;

  const firstName = data.me.name.trim().split(/\s+/)[0] ?? "";
  const topBar = (
    <NavBar
      start={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("screens.account.open")}
          onPress={() => router.push("/account")}
          hitSlop={8}
          className="active:opacity-70"
        >
          <Avatar name={data.me.name} />
        </Pressable>
      }
    />
  );

  const phone = data.me.phone.replace(/^\+20/, "");

  return (
    <Screen>
      {topBar}
      <Title
        subtitle={
          data.invitations.length > 0
            ? t("screens.firstRun.invitedSubtitle", { count: data.invitations.length })
            : draft
              ? t("screens.firstRun.draftSubtitle")
              : t("screens.firstRun.emptySubtitle")
        }
      >
        {t("screens.firstRun.welcome", { name: firstName })}
      </Title>
      <StartOptions
        invitations={data.invitations}
        phone={phone}
        draft={draft}
        onOpen={invitation.open}
        onHaveCode={() => invitation.open("code")}
        onDeclined={invitation.drop}
      />

      {invitation.sheet}
    </Screen>
  );
}
