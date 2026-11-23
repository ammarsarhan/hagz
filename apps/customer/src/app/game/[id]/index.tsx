import type { components } from "@hagz/api";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SectionBreak } from "@/components/booking-sections";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconBrandWhatsapp, IconPhone, IconQrcode } from "@/components/icons";
import { BackButton, RoundButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { Sheet } from "@/components/sheet";
import { useSignInSheet } from "@/components/sign-in-sheet";
import { SpotsRow } from "@/components/spots-row";
import { Text } from "@/components/text";
import { VenueLink } from "@/components/venue-link";
import { GroupHeading } from "@/components/venue-sections";
import i18n from "@/i18next/i18next";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import { push } from "@/lib/navigation";
import { COUNTRY_CODE, displayPhone, isolate } from "@/lib/phone";
import {
  dayLabel,
  daysUntil,
  hourAt,
  kindOf,
  listText,
  localDateOf,
  timeOfDay,
  timeRange,
} from "@/lib/venue";

// A game (Figma C11): one page, three ways.
// - Open to join (284:2): how many spots are left, the spots row, whose game it is, the booker's
//   note, what you pay at the venue, what Hagz doesn't promise, and Join game (lime) asking first in
//   a sheet (285:2). Public: a guest is asked to sign in to join.
// - Joined (286:2): Check in at the desk with Show my code, who's playing by name (and you), the
//   booker to call or message, what you pay, and Leave game until kick-off.
// - Full, or no longer taking players (287:2): the spots row, why, and Find another game.
// The booker's own view is the booking's (282:2, later).

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

  const read = useCallback(
    () =>
      send(api.GET("/v1/games/{gameId}", { params: { path: { gameId: id } } })).then((result) => {
        setLoaded((now) =>
          result.ok
            ? { state: "ready", game: result.data }
            : // A failed read again keeps what's shown.
              now.state === "ready"
              ? now
              : { state: "failed", error: result.error },
        );
      }),
    [id],
  );

  useEffect(() => {
    void read();
  }, [read, attempt]);

  // Back from checking in: read again, so the card says so.
  const [shown, setShown] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (shown) void read();
      setShown(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [read]),
  );

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
  const joined = game.me?.status === "JOINED";
  const mine = game.me?.booker ?? false;
  // Your own game: managed from your booking.
  const bookingId = game.me?.bookingId;
  if (mine && bookingId) return <ToYourGame bookingId={bookingId} />;
  if (joined) return <Joined game={game} onChange={onChange} />;
  if (!mine && !game.joinable) return <Unavailable game={game} />;
  return <Open game={game} onChange={onChange} />;
}

function ToYourGame({ bookingId }: { bookingId: string }) {
  useEffect(() => {
    router.replace({ pathname: "/bookings/[id]/game", params: { id: bookingId } });
  }, [bookingId]);
  return <PageState loading />;
}

// What every view starts with: back, then when, and the ground and venue under it.
function Page({
  game,
  above,
  children,
  bottom,
  footer,
}: {
  game: Game;
  // Over the title (the open game's spots left).
  above?: ReactNode;
  children: ReactNode;
  // Room kept under the scroll for what's pinned at the bottom.
  bottom: number;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { timezone, venue, ground } = game;
  const venueName = venue.name ?? t("screens.venue.fallbackName");
  const area = venue.area?.split(",")[0]?.trim();
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
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: bottom }}
      >
        {above}
        <Title game={game} />
        <Text className="mt-1 text-body leading-[23px] text-ink-2">
          {[
            ground.name ?? kindOf(ground),
            kindOf(ground),
            area ? `${venueName}, ${area}` : venueName,
          ].join(" · ")}
        </Text>
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

function Title({ game }: { game: Game }) {
  const { t } = useTranslation();
  return (
    <Text accessibilityRole="header" className="pt-1.5 text-title font-semibold tracking-[-0.4px]">
      {t("formats.moment", {
        day: dayOf(game.startsAt, game.timezone),
        time: timeRange(game.startsAt, game.endsAt, game.timezone),
      })}
    </Text>
  );
}

// Where: the venue, opening its page.
function Where({ game }: { game: Game }) {
  const { t } = useTranslation();
  return (
    <>
      <SectionBreak />
      <View className="pb-3">
        <GroupHeading>{t("screens.game.where")}</GroupHeading>
      </View>
      <VenueLink
        slug={game.venue.slug}
        name={game.venue.name ?? t("screens.venue.fallbackName")}
        place={game.venue.area}
      />
    </>
  );
}

// What a player pays, all of it in person: the share to the booker, the fee to the venue.
function WhatYouPay({ game }: { game: Game }) {
  const { t } = useTranslation();
  const booker = game.booker.firstName;
  const venueName = game.venue.name ?? t("screens.venue.fallbackName");
  return (
    <View className="gap-2">
      <View className="pb-1.5">
        <GroupHeading>{t("screens.game.payHeading")}</GroupHeading>
      </View>
      <Line
        label={t("screens.game.share", { name: booker })}
        value={formatPrice(game.sharePrice, game.currency)}
      />
      <Line
        label={t("screens.game.fee", { venue: venueName })}
        value={formatPrice(game.joinFee, game.currency)}
      />
      <View className="py-1.5">
        <View className="h-px bg-border" />
      </View>
      <Line
        label={t("screens.game.total")}
        value={formatPrice(game.sharePrice + game.joinFee, game.currency)}
        strong
      />
    </View>
  );
}

// ---- Open to join -------------------------------------------------------------------------

function Open({ game, onChange }: { game: Game; onChange: (game: Game) => void }) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const { whenSignedIn, sheet: signInSheet } = useSignInSheet({
    pathname: "/game/[id]",
    params: { id: game.id },
  });
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  // The HUD sits above the Join bar.
  const [bar, setBar] = useState(0);

  const booker = game.booker.firstName;
  const venueName = game.venue.name ?? t("screens.venue.fallbackName");
  const when = t("formats.moment", {
    day: dayOf(game.startsAt, game.timezone),
    time: timeRange(game.startsAt, game.endsAt, game.timezone),
  });
  const share = formatPrice(game.sharePrice, game.currency);
  const fee = formatPrice(game.joinFee, game.currency);
  const total = formatPrice(game.sharePrice + game.joinFee, game.currency);
  const mine = game.me?.booker ?? false;
  useHudAnchor(mine ? insets.bottom : bar);

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

  return (
    <Page
      game={game}
      above={
        <Text className="pb-1 text-caption leading-[18px] font-medium">
          {t("screens.game.spots", { left: game.spotsLeft, count: game.neededPlayers })}
        </Text>
      }
      bottom={mine ? 40 : 140}
      footer={
        <>
          {mine ? null : (
            <View
              className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between border-t border-border bg-white px-6 pt-3.5"
              style={{ paddingBottom: insets.bottom + 12 }}
              onLayout={(event) => setBar(event.nativeEvent.layout.height)}
            >
              <View className="gap-0.5">
                <Text className="text-[17px] leading-[22px] font-medium">{total}</Text>
                <Text className="text-caption leading-[18px] text-unit">
                  {t("screens.game.atVenue")}
                </Text>
              </View>
              <View className="w-[150px]">
                <Button
                  label={t("screens.game.join")}
                  size="small"
                  variant="moment"
                  onPress={() =>
                    void whenSignedIn(() => setAsking(true), {
                      title: t("screens.game.signIn.title"),
                      body: t("screens.game.signIn.body", { name: booker }),
                    })
                  }
                />
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
        </>
      }
    >
      {/* Who's in: the booker, the players joined, the spots still open. */}
      <View className="mt-5">
        <SpotsRow
          booker={booker}
          joined={game.playerCount}
          names={game.players?.map((player) => player.firstName) ?? null}
          open={game.spotsLeft}
          size={34}
        />
        <Text className="pt-2.5 text-label leading-5 text-ink-2">
          {t("screens.game.whose", { name: booker })}
        </Text>
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

      <Where game={game} />
      <SectionBreak />
      <WhatYouPay game={game} />
      <SectionBreak />
      <Text className="text-caption leading-[18px] text-unit">{t("screens.game.disclaimer")}</Text>
    </Page>
  );
}

// ---- Joined -------------------------------------------------------------------------------

function Joined({ game, onChange }: { game: Game; onChange: (game: Game) => void }) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const [leaving, setLeaving] = useState(false);
  const [sending, setSending] = useState(false);
  useHudAnchor(insets.bottom);
  const booker = game.booker.firstName;
  const started = Date.parse(game.startsAt) <= Date.now();
  const players = game.players ?? [];
  // "Omar, Karim, Youssef and you": the booker, the others in the order they joined, you last.
  const names = [
    booker,
    ...players.filter((player) => !player.you).map((player) => player.firstName),
    ...(players.some((player) => player.you) ? [t("screens.game.you")] : []),
  ];
  const phone = game.bookerPhone;

  const leave = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/games/{gameId}/leave", { params: { path: { gameId: game.id } } }),
    );
    setSending(false);
    setLeaving(false);
    if (result.ok) onChange(result.data);
    else hud.show(hudMessage(result.error));
  };

  return (
    <Page
      game={game}
      bottom={insets.bottom + 40}
      footer={
        <Sheet visible={leaving} onClose={() => !sending && setLeaving(false)}>
          <Text className="text-heading font-semibold tracking-[-0.4px]">
            {t("screens.game.leaveSheet.title", { name: booker })}
          </Text>
          <Text className="pt-2 text-body leading-[21px] text-ink-2">
            {t("screens.game.leaveSheet.body")}
          </Text>
          <View className="mt-6">
            <Button
              label={t("screens.game.leave")}
              loading={sending}
              onPress={() => void leave()}
            />
          </View>
        </Sheet>
      }
    >
      <CheckInCard game={game} />

      <View className="mt-[22px]">
        <View className="pb-3">
          <GroupHeading>{t("screens.game.whoHeading")}</GroupHeading>
        </View>
        <SpotsRow
          booker={booker}
          joined={game.playerCount}
          names={players.map((player) => player.firstName)}
          open={game.spotsLeft}
          size={34}
        />
        <Text className="pt-2.5 text-label leading-5 text-ink-2">{listText(names)}</Text>
      </View>

      {/* The booker: who to call or message about the game. */}
      <View className="mt-[22px] flex-row items-center gap-3.5">
        <View className="size-11 items-center justify-center rounded-full bg-chip">
          <Text className="text-[15px] font-semibold">{booker.trim().charAt(0).toUpperCase()}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-subtitle leading-[22px] font-medium">
            {t("screens.game.bookerTitle", { name: booker })}
          </Text>
          {phone ? (
            <Text className="text-label leading-5 text-ink-2">
              {isolate(
                phone.startsWith(COUNTRY_CODE)
                  ? displayPhone(phone.slice(COUNTRY_CODE.length))
                  : phone,
              )}
            </Text>
          ) : null}
        </View>
        {phone ? (
          <View className="flex-row gap-2.5">
            <RoundButton
              icon={IconPhone}
              label={t("screens.game.call", { name: booker })}
              onPress={() => void Linking.openURL(`tel:${phone}`)}
            />
            <RoundButton
              icon={IconBrandWhatsapp}
              label={t("screens.game.whatsapp", { name: booker })}
              onPress={() => void Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}
            />
          </View>
        ) : null}
      </View>

      <Where game={game} />
      <SectionBreak />
      <WhatYouPay game={game} />

      {started || game.status === "CANCELLED" ? null : (
        <View className="mt-[22px]">
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setLeaving(true)}
            className="self-start py-1.5 active:opacity-60"
          >
            <Text className="text-subtitle leading-[22px] font-medium underline">
              {t("screens.game.leave")}
            </Text>
          </Pressable>
          <Text className="text-caption leading-[18px] text-unit">
            {t("screens.game.leaveLine")}
          </Text>
        </View>
      )}
    </Page>
  );
}

// Where the player stands at the venue: check in (with the code), checked in, or called off.
function CheckInCard({ game }: { game: Game }) {
  const { t } = useTranslation();
  const { timezone } = game;
  const window = game.me?.checkIn ?? null;
  const card = (() => {
    if (game.status === "CANCELLED")
      return {
        title: t("screens.game.calledOff.title", { name: game.booker.firstName }),
        body: t("screens.game.calledOff.body"),
      };
    if (window?.checkedInAt)
      return {
        title: t("screens.booking.checkedIn.title"),
        body: t("screens.booking.checkedIn.body", {
          time: timeOfDay(window.checkedInAt, timezone),
        }),
      };
    if (window && Date.now() < Date.parse(window.closesAt))
      return {
        title: t("screens.booking.checkIn.title"),
        body: t("screens.booking.checkIn.body", {
          from: timeOfDay(window.opensAt, timezone),
          until: timeOfDay(window.closesAt, timezone),
        }),
        showCode: true,
      };
    return null;
  })();
  if (!card) return null;
  return (
    <View className="mt-5 gap-3 rounded-[20px] bg-chip p-[18px]">
      <View className="gap-0.5">
        <Text className="text-subtitle leading-[22px] font-medium">{card.title}</Text>
        <Text className="text-label leading-5 text-ink-2">{card.body}</Text>
      </View>
      {card.showCode ? (
        <Button
          label={t("screens.booking.showCode")}
          size="compact"
          icon={<IconQrcode size={18} color={colors.white} strokeWidth={2} />}
          onPress={() => push({ pathname: "/game/[id]/check-in", params: { id: game.id } })}
        />
      ) : null}
    </View>
  );
}

// ---- Full, or no longer taking players ------------------------------------------------------

function Unavailable({ game }: { game: Game }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const name = game.booker.firstName;
  // The HUD sits above Find another game.
  const [button, setButton] = useState(0);
  useHudAnchor(button > 0 ? button + insets.bottom + 12 : insets.bottom);
  const why =
    game.me?.status === "REMOVED"
      ? t("screens.game.unavailable.removed")
      : game.status === "OPEN" && game.spotsLeft === 0
        ? t("screens.game.unavailable.full", { name })
        : Date.parse(game.startsAt) <= Date.now()
          ? t("screens.game.unavailable.started", { name })
          : t("screens.game.unavailable.closed", { name });
  return (
    <Page
      game={game}
      bottom={insets.bottom + 96}
      footer={
        <View
          className="absolute right-6 left-6"
          style={{ bottom: insets.bottom + 12 }}
          onLayout={(event) => setButton(event.nativeEvent.layout.height)}
        >
          <Button
            label={t("screens.game.findAnother")}
            onPress={() => router.dismissTo("/community")}
          />
        </View>
      }
    >
      <View className="mt-5">
        <SpotsRow
          booker={name}
          joined={game.playerCount}
          names={null}
          open={game.spotsLeft}
          size={34}
        />
        <Text className="pt-2.5 text-label leading-5 text-ink-2">{why}</Text>
      </View>
    </Page>
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
