import type { components } from "@hagz/api";
import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { whenDay } from "@/components/home-rails";
import i18n from "@/i18next/i18next";
import { useHudAnchor } from "@/components/hud";
import { PageState } from "@/components/page-state";
import { ScrollPage } from "@/components/scroll-page";
import { Text } from "@/components/text";
import { VenueLink } from "@/components/venue-link";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { push } from "@/lib/navigation";
import { kindOf, timeRange } from "@/lib/venue";

// A booking's share link, /booking/{code} (ROUTES.sharedBooking), when the app is installed: the
// universal link lands here (the web page W4, Figma 316:2–320:2, is what it opens without the app).
// An open game goes straight to the game's page (join, full, or the booker's own view from there);
// the player's own booking to their booking. Anyone else's: what, when and where, and the venue
// to book their own; moved, the old and the new time and on to the new link; called off, so.

type Shared = components["schemas"]["SharedBooking"];
type Loaded =
  | { state: "loading" }
  | { state: "failed"; error: unknown }
  | { state: "ready"; booking: Shared; moved: Shared | null };

// Not happening: called off, never approved or paid, or a regular's week let go.
const OFF = new Set(["CANCELLED", "EXPIRED", "RELEASED"]);

const read = (code: string) =>
  send(api.GET("/v1/shared-bookings/{code}", { params: { path: { code } } }));

export default function SharedBookingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  const load = useCallback(async () => {
    const result = await read(code);
    if (!result.ok) {
      setLoaded({ state: "failed", error: result.error });
      return;
    }
    const booking = result.data;
    // Where the app already has a page for it, open that instead.
    if (booking.yours) {
      router.replace({ pathname: "/bookings/[id]", params: { id: booking.yours } });
      return;
    }
    if (booking.gameId) {
      router.replace({ pathname: "/game/[id]", params: { id: booking.gameId } });
      return;
    }
    // Moved: the new time too, to show beside the old.
    const moved = booking.movedTo ? await read(booking.movedTo) : null;
    setLoaded({ state: "ready", booking, moved: moved?.ok ? moved.data : null });
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loaded.state === "loading") return <PageState loading />;
  if (loaded.state === "failed") {
    return (
      <PageState
        error={loaded.error}
        onRetry={() => {
          setLoaded({ state: "loading" });
          void load();
        }}
      />
    );
  }
  const { booking, moved } = loaded;
  if (booking.status === "RESCHEDULED" && booking.movedTo)
    return <Moved booking={booking} moved={moved} to={booking.movedTo} />;
  if (OFF.has(booking.status) || booking.status === "RESCHEDULED")
    return <CalledOff booking={booking} />;
  return <Someones booking={booking} />;
}

// "Tonight, 9 – 11 pm", "Thu 26 Nov, 9 – 11 pm", on the venue's clock.
const when = (booking: Shared) =>
  i18n.t("formats.moment", {
    day: whenDay(booking.startsAt, booking.timezone),
    time: timeRange(booking.startsAt, booking.endsAt, booking.timezone),
  });

const groundLine = (booking: Shared) =>
  [booking.ground.name, kindOf(booking.ground)].filter(Boolean).join(" · ");

// The page: back, the code over the title, what's under it, the venue, and one button pinned at
// the bottom.
function Shell({
  booking,
  title,
  line,
  children,
  action,
}: {
  booking: Shared;
  title: string;
  line: string;
  children?: ReactNode;
  action: { label: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [button, setButton] = useState(0);
  useHudAnchor(button > 0 ? button + insets.bottom + 12 : insets.bottom);
  return (
    <ScrollPage
      bottom={insets.bottom + 96}
      footer={
        <View
          className="absolute right-6 left-6"
          style={{ bottom: insets.bottom + 12 }}
          onLayout={(event) => setButton(event.nativeEvent.layout.height)}
        >
          <Button label={action.label} onPress={action.onPress} />
        </View>
      }
    >
      <Text className="text-caption leading-[18px] font-medium tracking-[1px] text-ink-2">
        #{booking.code}
      </Text>
      <Text
        accessibilityRole="header"
        className="pt-1.5 text-title font-semibold tracking-[-0.4px]"
      >
        {title}
      </Text>
      <Text className="mt-1 text-body leading-[23px] text-ink-2">{line}</Text>
      <View className="mt-6 border-y border-hairline py-4">
        <VenueLink
          slug={booking.venue.slug}
          name={booking.venue.name ?? t("screens.venue.fallbackName")}
          place={booking.venue.area}
        />
      </View>
      {children}
    </ScrollPage>
  );
}

const openVenue = (booking: Shared) =>
  push({ pathname: "/venue/[slug]", params: { slug: booking.venue.slug } });

// Someone else's booking: when and where, and the venue to book a time of their own.
function Someones({ booking }: { booking: Shared }) {
  const { t } = useTranslation();
  const venue = booking.venue.name ?? t("screens.venue.fallbackName");
  const played = Date.parse(booking.endsAt) <= Date.now();
  return (
    <Shell
      booking={booking}
      title={when(booking)}
      line={groundLine(booking)}
      action={{ label: t("screens.shared.seeVenue", { venue }), onPress: () => openVenue(booking) }}
    >
      <Text className="mt-5 text-body leading-[23px] text-ink-2">
        {played ? t("screens.shared.played", { venue }) : t("screens.shared.someones", { venue })}
      </Text>
    </Shell>
  );
}

// Moved by the venue: the old time struck, the new one, and on to the new link.
function Moved({ booking, moved, to }: { booking: Shared; moved: Shared | null; to: string }) {
  const { t } = useTranslation();
  return (
    <Shell
      booking={booking}
      title={t("screens.shared.moved.title")}
      line={groundLine(booking)}
      action={{
        label: t("screens.shared.moved.action"),
        onPress: () => router.replace({ pathname: "/booking/[code]", params: { code: to } }),
      }}
    >
      <View className="mt-5 gap-3 rounded-2xl border border-border p-4">
        <View className="gap-0.5">
          <Text className="text-caption leading-[18px] text-unit">
            {t("screens.shared.moved.was")}
          </Text>
          <Text className="text-body leading-[22px] text-ink-2 line-through">{when(booking)}</Text>
        </View>
        {moved ? (
          <View className="gap-0.5">
            <Text className="text-caption leading-[18px] text-unit">
              {t("screens.shared.moved.now")}
            </Text>
            <Text className="text-body leading-[22px] font-medium">{when(moved)}</Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-4 text-body leading-[23px] text-ink-2">
        {t("screens.shared.moved.line")}
      </Text>
    </Shell>
  );
}

// Called off: nothing to join; the venue may have other times.
function CalledOff({ booking }: { booking: Shared }) {
  const { t } = useTranslation();
  const venue = booking.venue.name ?? t("screens.venue.fallbackName");
  return (
    <Shell
      booking={booking}
      title={t("screens.shared.off.title")}
      line={[when(booking), groundLine(booking)].join(" · ")}
      action={{ label: t("screens.shared.seeVenue", { venue }), onPress: () => openVenue(booking) }}
    >
      <Text className="mt-5 text-body leading-[23px] text-ink-2">
        {t("screens.shared.off.line", { venue })}
      </Text>
    </Shell>
  );
}
