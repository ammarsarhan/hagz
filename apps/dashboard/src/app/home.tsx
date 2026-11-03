import type { components } from "@hagz/api";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";
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
import { displayPhone, isolate } from "@/lib/phone";

type Staff = components["schemas"]["Staff"];
type StaffVenue = components["schemas"]["StaffVenue"];

interface Loaded {
  me: Staff;
  venues: StaffVenue[];
  invitations: ReceivedInvitation[];
}

// Where signing in lands. Staff who belong to a venue go to it (its home comes next); staff who
// don't see first run: their invitations, or how to create a venue or be invited, and "Have a code?".
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

  const invited = data.invitations.length > 0;

  return (
    <Screen
      footer={
        <>
          <Button
            label={t("screens.firstRun.createVenueTitle")}
            variant={invited ? "secondary" : "primary"}
            onPress={() => router.push("/create-venue")}
          />
          <Button
            label={t("screens.firstRun.haveCode")}
            variant="ghost"
            onPress={() => openSheet("code")}
          />
        </>
      }
    >
      {/* Outside the scroll view: it would clip the round buttons, which sit 4px outside the gutter. */}
      {topBar}
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Title
          subtitle={
            invited ? t("screens.firstRun.invitedSubtitle") : t("screens.firstRun.emptySubtitle")
          }
        >
          {t("screens.firstRun.welcome", { name: firstName })}
        </Title>

        {invited ? (
          <>
            <Text className="mb-2 text-label font-medium text-ink-2">
              {t("screens.firstRun.invitations")}
            </Text>
            {data.invitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                onPress={() => openSheet(invitation)}
              />
            ))}
          </>
        ) : (
          <InfoRows
            rows={[
              {
                title: t("screens.firstRun.createVenueTitle"),
                body: t("screens.firstRun.createVenueBody"),
              },
              {
                title: t("screens.firstRun.joiningTitle"),
                body: t("screens.firstRun.joiningBody", {
                  phone: isolate(displayPhone(data.me.phone.replace(/^\+20/, ""))),
                }),
              },
            ]}
          />
        )}
      </ScrollView>

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
          onDeclined={(id) =>
            closeSheet(() =>
              setData((current) =>
                current
                  ? { ...current, invitations: current.invitations.filter((i) => i.id !== id) }
                  : current,
              ),
            )
          }
        />
      ) : null}
    </Screen>
  );
}
