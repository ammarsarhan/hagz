import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  LayoutAnimation,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { InfoRows } from "@/components/info-rows";
import { InvitationCard, type ReceivedInvitation } from "@/components/invitation-card";
import { InvitationSheet, type SheetStart } from "@/components/invitation-sheet";
import { NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { StartTiles } from "@/components/start-tiles";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { resetTo } from "@/lib/navigation";
import { pendingInvitation } from "@/lib/pending-invitation";
import { queries } from "@/lib/queries";
import { signOut } from "@/lib/session";
import { displayPhone, isolate } from "@/lib/phone";

// The carousel runs left to right; in Arabic it's flipped so the next card comes from the left, as
// onboarding's pager does. Builds that are natively right-to-left already scroll that way.
const flipRail = isRTL && !I18nManager.isRTL;
const GUTTER = 20;
const CARD_GAP = 10;
// How much of the next card shows at the edge, so the row reads as more to swipe.
const PEEK = 32;

// Where signing in lands. Staff who belong to a venue go to it (its home comes next); staff who
// don't see first run (Figma "D2 · First run, carousel option"): their invitations as a swipeable
// row of blue cards, then the other ways to start. It fits on one screen, so the page doesn't scroll;
// only the carousel moves, and it runs to the screen edges. An invitation link opened on the way
// here (manage/invite/[code]) opens in the sheet once the page has loaded.
export default function Home() {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  // Cached: coming back to this screen, or opening the account page, doesn't fetch them again. They
  // change when an invitation is answered, which updates or invalidates them below.
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
  // The sheet's content, kept while it slides away; `sheetOpen` is what shows or hides it.
  const [sheet, setSheet] = useState<SheetStart | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Each opening is a fresh sheet, even over one still showing (a second link while the first is up).
  const [sheetKey, setSheetKey] = useState(0);
  // What to do once the sheet has slid away (reload, or drop a declined invitation).
  const afterSheet = useRef<() => void>(() => undefined);
  const [declining, setDeclining] = useState<string | null>(null);
  const openSheet = (start: SheetStart) => {
    setSheet(start);
    setSheetKey((key) => key + 1);
    setSheetOpen(true);
  };
  const closeSheet = (then: () => void) => {
    afterSheet.current = then;
    setSheetOpen(false);
  };

  useEffect(() => {
    if (failed) hud.show(hudMessage(failure));
  }, [failed, failure, hud]);

  const retry = () => {
    for (const read of reads) if (read.isError) void read.refetch();
  };

  // Joined a venue, or found an invitation had ended: which venues they're on and what's still open
  // may both have changed.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
    void queryClient.invalidateQueries({ queryKey: queries.invitations.queryKey });
  };

  // Opened from a link: once there's a page under it, the sheet looks the code up. On focus, not
  // only on mount: a link opened while first run is already up lands back on this same screen,
  // which doesn't mount again.
  const loaded = data !== null;
  useFocusEffect(
    useCallback(() => {
      if (!loaded) return;
      const link = pendingInvitation.take();
      if (link) openSheet({ link });
    }, [loaded]),
  );

  // Signed in with the wrong number: sign out, keeping the code, so signing in with the invited
  // number opens it again. Onboarding stays underneath sign-in, as when signing in from the start.
  const switchNumber = async (code: string) => {
    await signOut();
    pendingInvitation.keep(code);
    resetTo("/");
    router.push("/sign-in");
  };

  const dropInvitation = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    queryClient.setQueryData(queries.invitations.queryKey, (current) =>
      current?.filter((invitation) => invitation.id !== id),
    );
  };

  // From the card: declining is final and needs no detail, so it doesn't go through the sheet.
  const decline = async (invitation: ReceivedInvitation) => {
    setDeclining(invitation.id);
    const result = await send(
      api.POST("/v1/staff/invitations/{invitationId}/decline", {
        params: { path: { invitationId: invitation.id } },
      }),
    );
    setDeclining(null);
    if (result.ok) dropInvitation(invitation.id);
    else hud.show(hudMessage(result.error));
  };

  const topBar = data ? (
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
  ) : null;

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

  const sheetView = sheet ? (
    <InvitationSheet
      key={sheetKey}
      start={sheet}
      phone={data.me.phone.replace(/^\+20/, "")}
      visible={sheetOpen}
      onHidden={() => {
        setSheet(null);
        afterSheet.current();
      }}
      onClose={() => closeSheet(() => undefined)}
      onJoined={() => closeSheet(refresh)}
      onDeclined={(id) => closeSheet(() => dropInvitation(id))}
      onSwitchNumber={(code) => void switchNumber(code)}
      onOutdated={refresh}
    />
  ) : null;

  const firstName = data.me.name.trim().split(/\s+/)[0] ?? "";

  // Belongs to a venue: its home is the next screen to build.
  const venue = data.venues[0];
  if (venue) {
    return (
      <Screen>
        {topBar}
        <Title subtitle={t("screens.venueHome.subtitle")}>{venue.name ?? ""}</Title>
        {sheetView}
      </Screen>
    );
  }

  const { invitations } = data;
  const invited = invitations.length > 0;
  const startTiles = (
    <StartTiles
      onCreateVenue={() => router.push("/create-venue")}
      onHaveCode={() => openSheet("code")}
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
            onOpen={openSheet}
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

      {sheetView}
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
