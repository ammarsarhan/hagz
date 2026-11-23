import type { components } from "@hagz/api";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SectionBreak } from "@/components/booking-sections";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { BackButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { Sheet } from "@/components/sheet";
import { useSignInSheet } from "@/components/sign-in-sheet";
import { SpotsRow } from "@/components/spots-row";
import { Text } from "@/components/text";
import { GroupHeading } from "@/components/venue-sections";
import i18n from "@/i18next/i18next";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import { dayLabel, daysUntil, hourAt, kindOf, listText, localDateOf, timeRange } from "@/lib/venue";

// An open game (Figma C11 "Game · Open to join", 284:2): how many spots are left, when, what and
// where; the spots row, whose game it is (the other players' names only once you've joined); the
// booker's note; what you pay at the venue (your share to the booker, the joining fee to the
// venue); what Hagz doesn't promise. Join game (lime, a big moment) asks first in a sheet (285:2).
// Public: a guest sees it all and is asked to sign in to join.

type Game = components["schemas"]["Game"];
type Loaded =
  { state: "loading" } | { state: "failed"; error: unknown } | { state: "ready"; game: Game };

const ROW = 40;
const EVENING = 17;

// "Tonight" (from 5 pm, else "Today"), "Tomorrow", or "Sat 28 Nov".
const dayOf = (iso: string, timezone: string) => {
  const days = daysUntil(iso, timezone);
  if (days === 0)
    return i18n.t(
      hourAt(iso, timezone) >= EVENING ? "screens.community.tonight" : "screens.community.today",
    );
  if (days === 1) return i18n.t("screens.community.tomorrow");
  return dayLabel(localDateOf(iso, timezone));
};

export default function GamePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void send(api.GET("/v1/games/{gameId}", { params: { path: { gameId: id } } })).then(
      (result) => {
        if (!active) return;
        setLoaded(
          result.ok
            ? { state: "ready", game: result.data }
            : { state: "failed", error: result.error },
        );
      },
    );
    return () => {
      active = false;
    };
  }, [id, attempt]);

  if (loaded.state === "loading") return <PageState loading />;
  if (loaded.state === "failed") {
    return (
      <PageState
        error={loaded.error}
        onRetry={() => {
          setLoaded({ state: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <Content game={loaded.game} onChange={(game) => setLoaded({ state: "ready", game })} />;
}

function Content({ game, onChange }: { game: Game; onChange: (game: Game) => void }) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const { whenSignedIn, sheet: signInSheet } = useSignInSheet({
    pathname: "/game/[id]",
    params: { id: game.id },
  });
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);

  const { timezone, currency, venue, ground } = game;
  const booker = game.booker.firstName;
  const venueName = venue.name ?? t("screens.venue.fallbackName");
  const when = t("formats.moment", {
    day: dayOf(game.startsAt, timezone),
    time: timeRange(game.startsAt, game.endsAt, timezone),
  });
  const area = venue.area?.split(",")[0]?.trim();
  const where = area ? `${venueName}, ${area}` : venueName;
  const share = formatPrice(game.sharePrice, currency);
  const fee = formatPrice(game.joinFee, currency);
  const total = formatPrice(game.sharePrice + game.joinFee, currency);
  const joined = game.me?.status === "JOINED";
  const mine = game.me?.booker ?? false;

  const who =
    game.players && (joined || mine)
      ? t("screens.game.playing", { names: listText([booker, ...game.players]) })
      : t("screens.game.whose", { name: booker });

  const join = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/games/{gameId}/join", { params: { path: { gameId: game.id } } }),
    );
    setSending(false);
    setAsking(false);
    if (result.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChange(result.data);
    } else hud.show(hudMessage(result.error));
  };

  const leave = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/games/{gameId}/leave", { params: { path: { gameId: game.id } } }),
    );
    setSending(false);
    if (result.ok) onChange(result.data);
    else hud.show(hudMessage(result.error));
  };

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <View className="px-5" style={{ paddingTop: insets.top + 8 }}>
        <View className="-mx-1 flex-row items-center" style={{ height: ROW }}>
          <BackButton onPress={() => router.back()} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }}
      >
        <Text className="text-caption leading-[18px] font-medium">
          {game.spotsLeft > 0
            ? t("screens.game.spots", { left: game.spotsLeft, count: game.neededPlayers })
            : t("screens.community.full")}
        </Text>
        <Text
          accessibilityRole="header"
          className="pt-2.5 text-title font-semibold tracking-[-0.4px]"
        >
          {when}
        </Text>
        <Text className="mt-1 text-body leading-[23px] text-ink-2">
          {[ground.name ?? kindOf(ground), kindOf(ground), where].join(" · ")}
        </Text>

        {/* Who's in: the booker, the players joined, the spots still open. */}
        <View className="mt-5">
          <SpotsRow
            booker={booker}
            joined={game.playerCount}
            names={game.players}
            open={game.spotsLeft}
            size={34}
          />
          <Text className="pt-2.5 text-label leading-5 text-ink-2">{who}</Text>
        </View>

        {game.note ? (
          <View
            className="mt-[18px] py-0.5"
            style={
              isRTL
                ? { borderRightWidth: 2, borderColor: colors.ink, paddingRight: 12 }
                : { borderLeftWidth: 2, borderColor: colors.ink, paddingLeft: 12 }
            }
          >
            <Text className="text-body leading-[21px]">{`“${game.note}”`}</Text>
          </View>
        ) : null}

        <SectionBreak />

        {/* What a player pays, all of it in person. */}
        <View className="gap-2">
          <View className="pb-1.5">
            <GroupHeading>{t("screens.game.payHeading")}</GroupHeading>
          </View>
          <Line label={t("screens.game.share", { name: booker })} value={share} />
          <Line label={t("screens.game.fee", { venue: venueName })} value={fee} />
          <View className="py-1.5">
            <View className="h-px bg-border" />
          </View>
          <Line label={t("screens.game.total")} value={total} strong />
        </View>

        <SectionBreak />
        <Text className="text-caption leading-[18px] text-unit">
          {t("screens.game.disclaimer")}
        </Text>
      </ScrollView>

      {/* What it costs, and joining (or where you stand). */}
      {mine ? null : (
        <View
          className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between border-t border-border bg-white px-6 pt-3.5"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="gap-0.5">
            <Text className="text-[17px] leading-[22px] font-medium">{total}</Text>
            <Text className="text-caption leading-[18px] text-unit">
              {joined ? t("screens.game.youreIn") : t("screens.game.atVenue")}
            </Text>
          </View>
          <View className="w-[150px]">
            {joined ? (
              <Button
                label={t("screens.game.leave")}
                size="small"
                variant="secondary"
                loading={sending}
                onPress={() => void leave()}
              />
            ) : (
              <Button
                label={
                  game.joinable
                    ? t("screens.game.join")
                    : game.spotsLeft === 0
                      ? t("screens.community.full")
                      : t("screens.game.closed")
                }
                size="small"
                variant="moment"
                disabled={!game.joinable}
                onPress={() =>
                  void whenSignedIn(() => setAsking(true), {
                    title: t("screens.game.signIn.title"),
                    body: t("screens.game.signIn.body", { name: booker }),
                  })
                }
              />
            )}
          </View>
        </View>
      )}

      {/* Join: asked first, with what's owed and to whom. */}
      <Sheet visible={asking} onClose={() => !sending && setAsking(false)}>
        <Text className="text-heading font-semibold tracking-[-0.4px]">
          {t("screens.game.sheet.title", { name: booker })}
        </Text>
        <Text className="pt-2 text-body leading-[21px] text-ink-2">
          {t("screens.game.sheet.body", { when, venue: venueName, share, name: booker, fee })}
        </Text>
        <Text className="pt-3 text-caption leading-[18px] text-unit">
          {t("screens.game.disclaimer")}
        </Text>
        <View className="mt-6">
          <Button
            label={t("screens.game.join")}
            variant="moment"
            loading={sending}
            onPress={() => void join()}
          />
        </View>
      </Sheet>
      {signInSheet}
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text
        className={`shrink text-body leading-[22px] ${strong ? "font-semibold" : "text-ink-2"}`}
      >
        {label}
      </Text>
      <Text className={`text-body leading-[22px] ${strong ? "font-semibold" : ""}`}>{value}</Text>
    </View>
  );
}
