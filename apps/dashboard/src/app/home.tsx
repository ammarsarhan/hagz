import type { components } from "@hagz/api";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  I18nManager,
  LayoutAnimation,
  useWindowDimensions,
  View,
} from "react-native";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { InfoRows } from "@/components/info-rows";
import { InvitationCard, type ReceivedInvitation } from "@/components/invitation-card";
import { InvitationSheet } from "@/components/invitation-sheet";
import { NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { displayPhone, isolate } from "@/lib/phone";

type Staff = components["schemas"]["Staff"];
type StaffVenue = components["schemas"]["StaffVenue"];

// The carousel runs left to right; in Arabic it's flipped so the next card comes from the left, as
// onboarding's pager does. Builds that are natively right-to-left already scroll that way.
const flipRail = isRTL && !I18nManager.isRTL;
const GUTTER = 20;
const CARD_GAP = 10;
// How much of the next card shows at the edge, so the row reads as more to swipe.
const PEEK = 32;

interface Loaded {
  me: Staff;
  venues: StaffVenue[];
  invitations: ReceivedInvitation[];
}

// Where signing in lands. Staff who belong to a venue go to it (its home comes next); staff who
// don't see first run (Figma "D2 · First run, carousel option"): their invitations as a swipeable
// row of blue cards, then the other ways to start. The whole page is one scroll view from edge to
// edge, with nothing pinned but the avatar bar, which gains a hairline once content passes under it.
export default function Home() {
  const { t } = useTranslation();
  const hud = useHud();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  // The sheet's content, kept while it slides away; `sheetOpen` is what shows or hides it.
  const [sheet, setSheet] = useState<ReceivedInvitation | "code" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // What to do once the sheet has slid away (reload, or drop a declined invitation).
  const afterSheet = useRef<() => void>(() => undefined);
  const [declining, setDeclining] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const openSheet = (start: ReceivedInvitation | "code") => {
    setSheet(start);
    setSheetOpen(true);
  };
  const closeSheet = (then: () => void) => {
    afterSheet.current = then;
    setSheetOpen(false);
  };

  const load = useCallback(async () => {
    setFailed(false);
    const [me, venues, invitations] = await Promise.all([
      send(api.GET("/v1/staff/me")),
      send(api.GET("/v1/staff/venues")),
      send(api.GET("/v1/staff/invitations")),
    ]);
    if (!me.ok || !venues.ok || !invitations.ok) {
      const error = [me, venues, invitations].find((result) => !result.ok);
      if (error && !error.ok) hud.show(hudMessage(error.error));
      setFailed(true);
      return;
    }
    setData({ me: me.data, venues: venues.data.data, invitations: invitations.data.data });
  }, [hud]);

  useEffect(() => {
    void load();
  }, [load]);

  const dropInvitation = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setData((current) =>
      current
        ? { ...current, invitations: current.invitations.filter((i) => i.id !== id) }
        : current,
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

  const topBar = data ? <NavBar start={<Avatar name={data.me.name} />} /> : null;

  if (!data) {
    return (
      <Screen
        footer={
          failed ? (
            <Button label={t("screens.firstRun.retry")} onPress={() => void load()} />
          ) : undefined
        }
      >
        {failed ? null : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.ink3} />
          </View>
        )}
      </Screen>
    );
  }

  const firstName = data.me.name.trim().split(/\s+/)[0] ?? "";

  // Belongs to a venue: its home is the next screen to build.
  const venue = data.venues[0];
  if (venue) {
    return (
      <Screen>
        {topBar}
        <Title subtitle={t("screens.venueHome.subtitle")}>{venue.name ?? ""}</Title>
      </Screen>
    );
  }

  const { invitations } = data;
  const invited = invitations.length > 0;
  const createVenue = {
    title: t("screens.firstRun.createVenueTitle"),
    body: t("screens.firstRun.createVenueBody"),
    onPress: () => router.push("/create-venue"),
  };
  const haveCode = {
    title: t("screens.firstRun.haveCode"),
    body: t("screens.firstRun.haveCodeBody"),
    onPress: () => openSheet("code"),
  };

  return (
    <Screen>
      {/* Outside the scroll view: it would clip the round buttons, which sit 4px outside the gutter.
          The bar's 22px gap is split around the hairline, which is where the page goes under. */}
      <View className="-mb-3">{topBar}</View>
      <Animated.View
        className="-mx-5 h-px bg-hairline"
        style={{
          opacity: scrollY.interpolate({
            inputRange: [0, 8],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
        }}
      />
      <Animated.ScrollView
        style={{ marginHorizontal: -GUTTER }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 11, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
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
            <InfoRows rows={[createVenue, haveCode]} />
          </>
        ) : (
          <InfoRows
            rows={[
              createVenue,
              {
                title: t("screens.firstRun.joiningTitle"),
                body: t("screens.firstRun.joiningBody", {
                  phone: isolate(displayPhone(data.me.phone.replace(/^\+20/, ""))),
                }),
              },
              haveCode,
            ]}
          />
        )}
      </Animated.ScrollView>

      {sheet ? (
        <InvitationSheet
          start={sheet}
          phone={data.me.phone.replace(/^\+20/, "")}
          visible={sheetOpen}
          onHidden={() => {
            setSheet(null);
            afterSheet.current();
          }}
          // The invitations may have changed (ended, joined elsewhere): show the current ones.
          onClose={() => closeSheet(() => void load())}
          onJoined={() => closeSheet(() => void load())}
          onDeclined={(id) => closeSheet(() => dropInvitation(id))}
        />
      ) : null}
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
        <View style={{ direction: isRTL ? "rtl" : "ltr" }}>{card(item, cardWidth)}</View>
      )}
    />
  );
}
