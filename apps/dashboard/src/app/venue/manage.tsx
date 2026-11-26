import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { Bone } from "@/components/bone";
import { useHud } from "@/components/hud";
import { IconChevronRight } from "@/components/icons";
import { Screen } from "@/components/screen";
import { SettingsHeading, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { api, reachable } from "@/lib/api";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { isRTL } from "@/lib/language";
import { fetched, queries } from "@/lib/queries";
import { regularsQuery } from "@/lib/regulars";
import { paymentLabel } from "@/lib/settings";

// The Venue tab (Figma "D3 · Venue tab, round 3", C): the venue's cover photo
// (grey and pulsing while it loads), its name and area
// centred under it, then the Account tab's headings and rows: Your venue (profile and photos,
// grounds, hours), People (customers, regulars, team) and Rules (booking settings, cancellations,
// payments). Each row's grey line says what's there now. Rows for an area the member can't see
// are left out. Setup's screens edit a live venue as they did the draft; rows whose screens
// aren't built yet say so.

const COVER_HEIGHT = 180;

export default function VenueTab() {
  const { t } = useTranslation();
  const hud = useHud();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const can = (area: keyof NonNullable<typeof venue>["permissions"]) =>
    venue !== undefined && venue.permissions[area] !== "none";

  const photos = useQuery({ ...queries.photos(venueId), enabled: can("venue") });
  const grounds = useQuery({ ...queries.grounds(venueId), enabled: can("schedule") });
  const detail = useQuery({ ...queries.venue(venueId), enabled: can("venue") });
  // Regulars are read with bookings: view, as the API asks.
  const regulars = useQuery({ ...regularsQuery(venueId), enabled: can("bookings") });
  const members = useQuery({
    queryKey: ["staff", "venues", venueId, "members"],
    queryFn: async () =>
      (
        await fetched(
          api.GET("/v1/staff/venues/{venueId}/members", { params: { path: { venueId } } }),
        )
      ).data,
    enabled: can("staff"),
  });
  const invited = useQuery({
    queryKey: ["staff", "venues", venueId, "invitations"],
    queryFn: async () =>
      (
        await fetched(
          api.GET("/v1/staff/venues/{venueId}/invitations", { params: { path: { venueId } } }),
        )
      ).data,
    enabled: can("staff"),
  });

  // The cover photo that has finished drawing, so the grey stand-in can go.
  const [loadedCover, setLoadedCover] = useState<string | null>(null);

  if (!venue) return <Screen tabbed>{null}</Screen>;

  const ready = photos.data?.filter((photo) => photo.status === "READY") ?? [];
  const photosLoading = can("venue") && photos.isPending;
  const groundCount = grounds.data?.length;
  const settings = detail.data?.settings;
  const comingNext = () => hud.show(t("common.comingNext"));
  const open = (path: string) => () => router.push(`/setup/${venueId}/${path}`);
  const chevron = (
    <IconChevronRight
      size={18}
      color={colors.unit}
      strokeWidth={2}
      style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );
  const v = "screens.venueTab";

  const team = (() => {
    if (!members.data) return t(`${v}.teamBody`);
    const people = t(`${v}.people`, { count: members.data.length });
    const waiting = invited.data?.length ?? 0;
    return waiting > 0 ? `${people} · ${t(`${v}.waiting`, { count: waiting })}` : people;
  })();

  const people = [
    can("customers") && {
      key: "customers",
      title: t(`${v}.customers`),
      body: t(`${v}.customersBody`),
      onPress: () => router.push("/customers"),
    },
    can("bookings") && {
      key: "regulars",
      title: t(`${v}.regulars`),
      body: regulars.data
        ? t(`${v}.weekly`, {
            count: regulars.data.filter((regular) => regular.status !== "ENDED").length,
          })
        : t(`${v}.regularsBody`),
      onPress: () => router.push("/regulars"),
    },
    can("staff") && { key: "team", title: t(`${v}.team`), body: team, onPress: comingNext },
  ];
  const place = [
    can("venue") && {
      key: "profile",
      title: t(`${v}.profile`),
      body: photos.data
        ? t(`${v}.profileBody`, { count: ready.length })
        : t(`${v}.profileBodyPlain`),
      onPress: open("details"),
    },
    can("schedule") && {
      key: "grounds",
      title: t(`${v}.grounds`),
      body:
        groundCount === undefined
          ? t(`${v}.groundsBodyPlain`)
          : t(`${v}.groundsBody`, { count: groundCount }),
      onPress: open("grounds"),
    },
    can("schedule") && {
      key: "hours",
      title: t(`${v}.hours`),
      body: t(`${v}.hoursBody`),
      onPress: open("hours"),
    },
  ];
  const rules = [
    can("venue") && {
      key: "booking",
      title: t(`${v}.bookingSettings`),
      body: t(`${v}.bookingSettingsBody`),
      onPress: comingNext,
    },
    can("venue") && {
      key: "cancellations",
      title: t(`${v}.cancellations`),
      body: settings?.cancellationPolicy
        ? t(`screens.setup.settings.cancellation.policies.${settings.cancellationPolicy}.title`)
        : t(`${v}.cancellationsBody`),
      onPress: open("settings/cancellation"),
    },
    can("venue") && {
      key: "payments",
      title: t(`${v}.payments`),
      body: settings ? payment(t, settings) : t(`${v}.paymentsBody`),
      onPress: open("settings"),
    },
  ];

  const group = (heading: string, rows: (false | Row)[], first = false) => {
    const shown = rows.filter((row): row is Row => row !== false);
    if (shown.length === 0) return null;
    return (
      <>
        <SettingsHeading first={first}>{heading}</SettingsHeading>
        {shown.map((row, index) => (
          <SettingsRow
            key={row.key}
            title={row.title}
            body={row.body}
            trailing={chevron}
            onPress={row.onPress}
            divider={index < shown.length - 1}
          />
        ))}
      </>
    );
  };

  return (
    <Screen tabbed>
      <ScrollView
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <View className="mt-5 overflow-hidden rounded-[20px]" style={{ height: COVER_HEIGHT }}>
          {ready[0] ? (
            <>
              {/* Grey and pulsing until the photo has come, then the photo over it. */}
              {loadedCover === ready[0].url ? null : <Bone className="absolute inset-0" />}
              {/* The full photo through reachable() (the dev API's host as the phone sees it),
                filling the space; no blurry preview while it loads. */}
              <Image
                source={{ uri: reachable(ready[0].url) }}
                contentFit="cover"
                transition={150}
                onLoad={() => setLoadedCover(ready[0]?.url ?? null)}
                style={{ width: "100%", height: "100%" }}
                accessibilityIgnoresInvertColors
              />
            </>
          ) : photosLoading ? (
            // The photos aren't known yet: grey, not the no-photo pitch, which would flash first.
            <Bone className="flex-1" />
          ) : (
            <PitchArt />
          )}
          {ready.length > 0 ? (
            <View className="absolute end-2.5 bottom-2.5 rounded-full bg-black/30 px-2 py-0.5">
              <Text className="text-[11px] font-medium leading-[14px] text-white">
                {t(`${v}.photos`, { count: ready.length })}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-4 items-center">
          <Text className="text-center text-[22px] font-semibold leading-[1.27]">
            {venue.name ?? ""}
          </Text>
          {/* The area, then how many grounds on a line of its own. */}
          {venue.location ? (
            <Text className="mt-1 text-center text-body text-ink-2">{venue.location}</Text>
          ) : null}
          {groundCount === undefined ? null : (
            <Text className="text-center text-body text-ink-2">
              {t(`${v}.groundCount`, { count: groundCount })}
            </Text>
          )}
        </View>

        {group(t(`${v}.yourVenue`), place, true)}
        {group(t(`${v}.peopleHeading`), people, !place.some(Boolean))}
        {group(t(`${v}.rules`), rules)}
      </ScrollView>
    </Screen>
  );
}

type Row = { key: string; title: string; body: string; onPress: () => void };

// "Paid at the venue", "30% deposit in the app", "Paid in the app".
const payment = (
  t: TFunction,
  settings: { paymentMode: Parameters<typeof paymentLabel>[1]; depositPercent: number | null },
) =>
  settings.paymentMode === "DEPOSIT" && settings.depositPercent !== null
    ? t("screens.venueTab.deposit", { percent: settings.depositPercent })
    : paymentLabel(t, settings.paymentMode);

// No photo yet: a pitch in white lines on the staff blue, where the cover goes.
function PitchArt() {
  const line = "rgba(255,255,255,0.55)";
  return (
    <View className="flex-1 bg-primary">
      <Svg width="100%" height="100%" viewBox="0 0 353 150" preserveAspectRatio="xMidYMid slice">
        <Rect
          x={35}
          y={24}
          width={283}
          height={102}
          rx={6}
          stroke={line}
          strokeWidth={1.5}
          fill="none"
        />
        <Line x1={176.5} y1={24} x2={176.5} y2={126} stroke={line} strokeWidth={1.5} />
        <Circle cx={176.5} cy={75} r={23} stroke={line} strokeWidth={1.5} fill="none" />
        <Path d="M35 48 H63 V102 H35" stroke={line} strokeWidth={1.5} fill="none" />
        <Path d="M318 48 H290 V102 H318" stroke={line} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}
