import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { InfoRows } from "@/components/info-rows";
import { InvitationCard, type ReceivedInvitation } from "@/components/invitation-card";
import { NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { StartTiles } from "@/components/start-tiles";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { useInvitationSheet } from "@/components/use-invitation-sheet";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { queries } from "@/lib/queries";
import { displayPhone, isolate } from "@/lib/phone";

// The carousel runs left to right; in Arabic it's flipped so the next card comes from the left, as
// onboarding's pager does. Builds that are natively right-to-left already scroll that way.
const flipRail = isRTL && !I18nManager.isRTL;
const GUTTER = 20;
const CARD_GAP = 10;
// How much of the next card shows at the edge, so the row reads as more to swipe.
const PEEK = 32;

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
  const reads = [me, venues, received];
  const failure = reads.find((read) => read.isError)?.error;
  const failed = failure !== undefined && failure !== null;
  const data =
    me.data && venues.data && received.data
      ? { me: me.data, venues: venues.data, invitations: received.data }
      : null;
  const hasVenue = (data?.venues.length ?? 0) > 0;
  const [declining, setDeclining] = useState<string | null>(null);
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

  // From the card: declining is final and needs no detail, so it doesn't go through the sheet.
  const decline = async (received: ReceivedInvitation) => {
    setDeclining(received.id);
    const result = await send(
      api.POST("/v1/staff/invitations/{invitationId}/decline", {
        params: { path: { invitationId: received.id } },
      }),
    );
    setDeclining(null);
    if (result.ok) invitation.drop(received.id);
    else hud.show(hudMessage(result.error));
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

  const { invitations } = data;
  const invited = invitations.length > 0;
  const startTiles = (
    <StartTiles
      onCreateVenue={() => router.push("/create-venue")}
      onHaveCode={() => invitation.open("code")}
    />
  );

  return (
    <Screen>
      {topBar}
      <Title
        subtitle={
          invited
            ? t("screens.firstRun.invitedSubtitle", { count: invitations.length })
            : t("screens.firstRun.emptySubtitle")
        }
      >
        {t("screens.firstRun.welcome", { name: firstName })}
      </Title>

      {invited ? (
        <>
          {invitations.length > 1 ? (
            <SectionLabel>
              {t("screens.firstRun.invitations", { count: invitations.length })}
            </SectionLabel>
          ) : null}
          <Invitations
            invitations={invitations}
            declining={declining}
            onOpen={invitation.open}
            onDecline={(invitation) => void decline(invitation)}
          />
          <View className="mt-[22px]">
            <SectionLabel>{t("screens.firstRun.moreWays")}</SectionLabel>
          </View>
          {startTiles}
        </>
      ) : (
        <>
          {startTiles}
          <View className="mt-[22px]">
            <InfoRows
              rows={[
                {
                  title: t("screens.firstRun.joiningTitle"),
                  body: t("screens.firstRun.joiningBody", {
                    phone: isolate(displayPhone(data.me.phone.replace(/^\+20/, ""))),
                  }),
                },
              ]}
            />
          </View>
        </>
      )}

      {invitation.sheet}
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text className="mb-2.5 text-label font-medium text-ink-2">{children}</Text>;
}

// One invitation fills the row. More become a carousel that runs to the screen edges: each card is
// narrower than the gutters so the next one peeks in, and a swipe snaps the next card to the gutter.
function Invitations({
  invitations,
  declining,
  onOpen,
  onDecline,
}: {
  invitations: ReceivedInvitation[];
  declining: string | null;
  onOpen: (invitation: ReceivedInvitation) => void;
  onDecline: (invitation: ReceivedInvitation) => void;
}) {
  const { width } = useWindowDimensions();
  const card = (invitation: ReceivedInvitation, cardWidth?: number) => (
    <InvitationCard
      invitation={invitation}
      width={cardWidth}
      declining={declining === invitation.id}
      onOpen={() => onOpen(invitation)}
      onDecline={() => onDecline(invitation)}
    />
  );

  const [only] = invitations;
  if (invitations.length === 1 && only) return card(only);

  const cardWidth = width - GUTTER * 2 - PEEK;
  return (
    <FlatList
      data={invitations}
      keyExtractor={(invitation) => invitation.id}
      horizontal
      inverted={flipRail}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + CARD_GAP}
      decelerationRate="fast"
      disableIntervalMomentum
      style={{ marginHorizontal: -GUTTER, direction: "ltr", flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: CARD_GAP }}
      renderItem={({ item }) => (
        <View style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}>{card(item, cardWidth)}</View>
      )}
    />
  );
}
