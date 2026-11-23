import { playersOn } from "@hagz/contracts";
import type { components } from "@hagz/api";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconDots, IconPhone } from "@/components/icons";
import { RoundButton } from "@/components/nav";
import { PageState } from "@/components/page-state";
import { Sheet } from "@/components/sheet";
import { SpotsRow } from "@/components/spots-row";
import { StepButton } from "@/components/step-button";
import { ScrollPage } from "@/components/scroll-page";
import { Text } from "@/components/text";
import { GroupHeading, Hairline } from "@/components/venue-sections";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { formatPrice } from "@/lib/money";
import { COUNTRY_CODE, displayPhone, isolate } from "@/lib/phone";
import { dayLabel, kindOf, listText, localDateOf, timeOfDay, timeRange } from "@/lib/venue";

// The booker's own open game (Figma C11 282:2, with the user's edits: no status line, no note,
// "Remove the listing"), opened from the booking: the spots row and what each player pays, who's
// coming (number, how reliably they show up, call, and remove: 308:2), how many players are needed
// (down to the number joined, up to the ground's), and Remove the listing (309:2, or 310:2 while
// players are in: the API only removes an empty listing).

type Booking = components["schemas"]["Booking"];
type Listing = NonNullable<Booking["listing"]>;
type Player = Listing["players"][number];
type Loaded =
  | { state: "loading" }
  | { state: "failed"; error: unknown }
  | { state: "ready"; booking: Booking; me: string };

// How long the stepper rests before the count is saved: taps in a row send once.
const SAVE_AFTER_MS = 500;

const initial = (name: string) => name.trim().charAt(0).toUpperCase();
const phoneText = (phone: string) =>
  isolate(phone.startsWith(COUNTRY_CODE) ? displayPhone(phone.slice(COUNTRY_CODE.length)) : phone);

export default function BookerGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Read each time it's shown: players join and leave while it's away.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        send(api.GET("/v1/bookings/{bookingId}", { params: { path: { bookingId: id } } })),
        send(api.GET("/v1/customers/me")),
      ]).then(([result, me]) => {
        if (!active) return;
        setLoaded((now) =>
          result.ok
            ? {
                state: "ready",
                booking: result.data,
                me: me.ok ? (me.data.name.trim().split(/\s+/)[0] ?? "") : t("screens.game.you"),
              }
            : now.state === "ready"
              ? now
              : { state: "failed", error: result.error },
        );
      });
      return () => {
        active = false;
      };
    }, [id, attempt, t]),
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
  const { booking, me } = loaded;
  const listing = booking.listing;
  // Removed (here or elsewhere), or the booking was cancelled: nothing left to manage.
  if (!listing || listing.status === "CLOSED" || listing.status === "CANCELLED") return <Gone />;
  return (
    <Content
      booking={booking}
      listing={listing}
      me={me}
      onChange={(next) => setLoaded({ state: "ready", booking: next, me })}
    />
  );
}

function Content({
  booking,
  listing,
  me,
  onChange,
}: {
  booking: Booking;
  listing: Listing;
  me: string;
  onChange: (booking: Booking) => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  // The player asked about stays in the sheet while it slides away.
  const [removing, setRemoving] = useState<Player | null>(null);
  const [asking, setAsking] = useState(false);
  const changed = useRef(onChange);
  changed.current = onChange;
  const [closing, setClosing] = useState(false);
  const [sending, setSending] = useState(false);
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer > 0 ? footer : insets.bottom);

  const { timezone } = booking.venue;
  const venueName = booking.venue.name ?? t("screens.venue.fallbackName");
  const groundName = booking.ground.name ?? kindOf(booking.ground);
  const started = Date.parse(booking.startsAt) <= Date.now();
  const players = listing.players;
  const joined = listing.playerCount;
  const most = playersOn(booking.ground.sport, booking.ground.size) - 1;
  const least = Math.max(1, joined);

  // Players needed: the count, the spots row and the line under it follow each tap at once; the
  // count is saved once the taps rest, and a refusal puts it back.
  const [needed, setNeeded] = useState(listing.neededPlayers);
  const left = Math.max(0, needed - joined);
  const saved = useRef(listing.neededPlayers);
  useEffect(() => {
    const before = saved.current;
    saved.current = listing.neededPlayers;
    // The saved count takes over only if nothing's been tapped since: a reply to an earlier save
    // doesn't undo the taps after it (those are saved next).
    setNeeded((now) => (now === before ? listing.neededPlayers : now));
  }, [listing.neededPlayers]);
  useEffect(() => {
    if (needed === saved.current) return;
    const timer = setTimeout(() => {
      void send(
        api.PATCH("/v1/bookings/{bookingId}/listing", {
          params: { path: { bookingId: booking.id } },
          body: { neededPlayers: needed },
        }),
      ).then((result) => {
        if (result.ok) changed.current(result.data);
        else {
          setNeeded(saved.current);
          hud.show(hudMessage(result.error));
        }
      });
    }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [needed, booking.id, hud]);

  const remove = async (player: Player) => {
    setSending(true);
    const result = await send(
      api.DELETE("/v1/bookings/{bookingId}/listing/players/{customerId}", {
        params: { path: { bookingId: booking.id, customerId: player.customerId } },
      }),
    );
    setSending(false);
    setAsking(false);
    if (result.ok) onChange(result.data);
    else hud.show(hudMessage(result.error));
  };

  const close = async () => {
    setSending(true);
    const result = await send(
      api.DELETE("/v1/bookings/{bookingId}/listing", {
        params: { path: { bookingId: booking.id } },
      }),
    );
    setSending(false);
    setClosing(false);
    if (result.ok) router.back();
    else hud.show(hudMessage(result.error));
  };

  const day = dayLabel(localDateOf(booking.startsAt, timezone));
  const range = timeRange(booking.startsAt, booking.endsAt, timezone);
  const share = formatPrice(listing.sharePrice, booking.currency);
  const fee = formatPrice(listing.joinFee, booking.currency);

  return (
    <ScrollPage
      bottom={(footer || insets.bottom) + 24}
      footer={
        <>
          {/* Remove the listing, pinned at the bottom: until kick-off. */}
          {started ? null : (
            <View
              className="absolute right-0 bottom-0 left-0 items-center bg-white pt-3"
              style={{ paddingBottom: insets.bottom + 12 }}
              onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
            >
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setClosing(true)}
                className="py-2 active:opacity-60"
              >
                <Text className="text-subtitle font-medium underline">
                  {t("screens.hosting.removeListing")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Remove a player (308:2). */}
          <Sheet visible={asking} onClose={() => !sending && setAsking(false)}>
            {removing ? (
              <>
                <View className="flex-row items-center gap-3.5">
                  <View className="size-11 items-center justify-center rounded-full bg-chip">
                    <Text className="text-[15px] font-semibold">{initial(removing.firstName)}</Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-subtitle leading-[22px] font-medium">
                      {removing.firstName}
                    </Text>
                    <Text className="text-label leading-5 text-ink-2">
                      <Standing player={removing} timezone={timezone} />
                    </Text>
                  </View>
                </View>
                <Text className="pt-5 text-heading font-semibold tracking-[-0.4px]">
                  {t("screens.hosting.removeSheet.title", { name: removing.firstName })}
                </Text>
                <Text className="pt-2 text-body leading-[21px] text-ink-2">
                  {t("screens.hosting.removeSheet.body", { name: removing.firstName })}
                </Text>
                <View className="mt-6 gap-2.5">
                  <Button
                    label={t("screens.hosting.removeName", { name: removing.firstName })}
                    loading={sending}
                    onPress={() => void remove(removing)}
                  />
                  <Button
                    label={t("screens.hosting.keepName", { name: removing.firstName })}
                    variant="secondary"
                    disabled={sending}
                    onPress={() => setAsking(false)}
                  />
                </View>
              </>
            ) : null}
          </Sheet>

          {/* Remove the listing: nobody's joined (309:2), or they have, so remove them first (310:2). */}
          <Sheet visible={closing} onClose={() => !sending && setClosing(false)}>
            {players.length > 0 ? (
              <>
                <Text className="text-heading font-semibold tracking-[-0.4px]">
                  {t("screens.hosting.playersFirst.title")}
                </Text>
                <Text className="pt-2 text-body leading-[21px] text-ink-2">
                  {t("screens.hosting.playersFirst.body", {
                    count: players.length,
                    names: listText(players.map((player) => player.firstName)),
                  })}
                </Text>
                <View className="mt-4 gap-3">
                  {players.map((player) => (
                    <View key={player.customerId} className="flex-row items-center gap-3">
                      <View className="size-9 items-center justify-center rounded-full bg-chip">
                        <Text className="text-[13px] font-semibold">
                          {initial(player.firstName)}
                        </Text>
                      </View>
                      <Text className="text-subtitle font-medium">{player.firstName}</Text>
                    </View>
                  ))}
                </View>
                <View className="mt-6">
                  <Button label={t("screens.hosting.gotIt")} onPress={() => setClosing(false)} />
                </View>
              </>
            ) : (
              <>
                <Text className="text-heading font-semibold tracking-[-0.4px]">
                  {t("screens.hosting.closeSheet.title")}
                </Text>
                <Text className="pt-2 text-body leading-[21px] text-ink-2">
                  {t("screens.hosting.closeSheet.body")}
                </Text>
                <View className="mt-6 gap-2.5">
                  <Button
                    label={t("screens.hosting.removeListing")}
                    loading={sending}
                    onPress={() => void close()}
                  />
                  <Button
                    label={t("screens.hosting.keepListed")}
                    variant="secondary"
                    disabled={sending}
                    onPress={() => setClosing(false)}
                  />
                </View>
              </>
            )}
          </Sheet>
        </>
      }
    >
      <Text
        accessibilityRole="header"
        className="pt-1.5 text-title font-semibold tracking-[-0.4px]"
      >
        {t("screens.hosting.title")}
      </Text>
      <Text className="mt-1 text-body leading-[23px] text-ink-2">
        {[t("formats.moment", { day, time: range }), groundName, venueName].join(" · ")}
      </Text>

      {/* The spots: you, who's joined, what's open; then what each player pays. */}
      <View className="mt-[22px]">
        <SpotsRow
          booker={me}
          joined={joined}
          names={players.map((player) => player.firstName)}
          open={left}
          size={34}
        />
        <Text className="pt-3 text-label leading-5 text-ink-2">
          <Text className="text-label leading-5 font-semibold text-ink">
            {left > 0 ? t("screens.hosting.spotsLeft", { count: left }) : t("screens.hosting.full")}
          </Text>
          {` ${t("screens.hosting.pays", { share, venue: venueName, fee })}`}
        </Text>
        {listing.status === "WAITING" ? (
          <Text className="pt-1.5 text-label leading-5 text-ink-2">
            {t("screens.hosting.waiting", { venue: venueName })}
          </Text>
        ) : null}
      </View>

      {/* Who's coming: each joined player, to call or remove. */}
      <View className="mt-[26px]">
        <GroupHeading>{t("screens.hosting.whoHeading")}</GroupHeading>
        {players.length === 0 ? (
          <Text className="pt-2 text-label leading-5 text-ink-2">
            {t("screens.hosting.nobody")}
          </Text>
        ) : (
          players.map((player, index) => (
            <View
              key={player.customerId}
              className={`flex-row items-center gap-3.5 py-3.5 ${index < players.length - 1 ? "border-b border-border" : ""}`}
            >
              <View className="size-11 items-center justify-center rounded-full bg-chip">
                <Text className="text-[15px] font-semibold">{initial(player.firstName)}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-subtitle leading-[22px] font-medium">{player.firstName}</Text>
                {player.phone ? (
                  <Text className="text-label leading-5 text-ink-2">{phoneText(player.phone)}</Text>
                ) : null}
                <Text className="text-label leading-5 text-ink-2">
                  <Standing player={player} timezone={timezone} />
                </Text>
              </View>
              {player.phone ? (
                <RoundButton
                  icon={IconPhone}
                  label={t("screens.game.call", { name: player.firstName })}
                  onPress={() => void Linking.openURL(`tel:${player.phone}`)}
                />
              ) : null}
              {started ? null : (
                <RoundButton
                  icon={IconDots}
                  label={t("screens.hosting.removeName", { name: player.firstName })}
                  onPress={() => {
                    setRemoving(player);
                    setAsking(true);
                  }}
                />
              )}
            </View>
          ))
        )}
      </View>

      {/* Players needed: down to those who've joined, up to what the ground takes. */}
      {started ? null : (
        <>
          <View className="mt-4">
            <Hairline />
          </View>
          <View className="flex-row items-center justify-between gap-4 pt-5">
            <View className="shrink">
              <Text className="text-subtitle leading-[22px] font-medium">
                {t("screens.hosting.needed")}
              </Text>
              <Text className="pt-0.5 text-label leading-5 text-ink-2">
                {joined > 0
                  ? t("screens.hosting.downTo", { count: joined })
                  : t("screens.hosting.upTo", { count: most })}
              </Text>
            </View>
            <View className="flex-row items-center gap-3.5">
              <StepButton
                icon="minus"
                label={t("screens.extras.players.less")}
                disabled={needed <= least}
                onPress={() => setNeeded((n) => Math.max(least, n - 1))}
              />
              <Text
                accessibilityLiveRegion="polite"
                className="min-w-5 text-center text-heading font-semibold"
              >
                {needed}
              </Text>
              <StepButton
                icon="plus"
                label={t("screens.extras.players.more")}
                disabled={needed >= most}
                onPress={() => setNeeded((n) => Math.min(most, n + 1))}
              />
            </View>
          </View>
        </>
      )}
    </ScrollPage>
  );
}

// The listing's gone (removed elsewhere, or the booking was cancelled): back to the booking.
function Gone() {
  useEffect(() => {
    router.back();
  }, []);
  return <PageState loading />;
}

// How a player stands: checked in (and when), how reliably they've shown up, or new to games.
function Standing({ player, timezone }: { player: Player; timezone: string }) {
  const { t } = useTranslation();
  if (player.checkedInAt)
    return <>{t("screens.hosting.checkedIn", { time: timeOfDay(player.checkedInAt, timezone) })}</>;
  const { games, showedUp } = player.reliability;
  if (games === 0) return <>{t("screens.hosting.newPlayer")}</>;
  return <>{t("screens.hosting.showedUp", { count: games, showedUp })}</>;
}
