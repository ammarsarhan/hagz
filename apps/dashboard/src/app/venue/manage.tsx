import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { Bone } from "@/components/bone";
import { PinnedTitle, useSectionTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { useHud } from "@/components/hud";
import { IconChevronRight } from "@/components/icons";
import { Screen } from "@/components/screen";
import { SettingsHeading, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api, reachable } from "@/lib/api";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { VenuePauseSheet } from "@/components/venue-pause-sheet";
import { isRTL } from "@/lib/language";
import { fetched, queries } from "@/lib/queries";
import { allows, RULES, type Rule } from "@/lib/access";
import { regularsQuery } from "@/lib/regulars";
import { invitationsQuery, membersQuery } from "@/lib/team";
import { paymentLabel } from "@/lib/settings";
import { push } from "@/lib/navigation";

// The Venue tab (Figma "D3 · Venue tab, round 3", C): the title, a plain bar pinned above the
// scroll (a hairline once scrolled; no section names coming into it, user 2026-11-26), the venue's photos
// taking turns every 5 seconds (grey and pulsing while the first loads), its name and area
// centred under it, then the Account tab's headings and rows: Details (profile and photos,
// grounds, hours), People (customers, regulars, team) and Rules (settings, payments,
// cancellations). Each row's grey line says what's there now. Rows for an area the member can't see
// are left out. Setup's screens edit a live venue as they did the draft; rows whose screens
// aren't built yet say so.

const COVER_HEIGHT = 180;
// How long each photo stays before the next fades in.
const PHOTO_MS = 5_000;
const FADE_MS = 600;

export default function VenueTab() {
  const { t } = useTranslation();
  const hud = useHud();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const can = (area: keyof NonNullable<typeof venue>["permissions"]) =>
    venue !== undefined && venue.permissions[area] !== "none";
  // A row shows when its screen would open (lib/access.ts), so none leads to a no-access page.
  const is = (rule: Rule) => allows(venue?.permissions, rule);

  const photos = useQuery({ ...queries.photos(venueId), enabled: can("venue") });
  const grounds = useQuery({ ...queries.grounds(venueId), enabled: can("schedule") });
  const detail = useQuery({ ...queries.venue(venueId), enabled: can("venue") });
  // Regulars are read with bookings: view, as the API asks.
  const regulars = useQuery({ ...regularsQuery(venueId), enabled: can("bookings") });
  const members = useQuery({ ...membersQuery(venueId), enabled: can("staff") });
  const invited = useQuery({ ...invitationsQuery(venueId), enabled: can("staff") });

  // The bar pinned above the scroll: each section's name once its heading goes under.
  const sections = useSectionTitle();
  // Pausing or reopening, asked in a sheet first; the switch shows what's saved until it's done.
  // As two-factor's switch does (user, 2026-11-27): the tap shows at once, greyed while the sheet
  // asks; saved, it stays; closed without, it goes back. `asked` lasts until the sheet has gone.
  const [asked, setAsked] = useState<"pause" | "resume" | null>(null);
  const [asking, setAsking] = useState(false);

  if (!venue) return <Screen tabbed>{null}</Screen>;

  const live = venue.status === "LIVE";
  const ready = photos.data?.filter((photo) => photo.status === "READY") ?? [];
  const photosLoading = can("venue") && photos.isPending;
  const groundCount = grounds.data?.length;
  const settings = detail.data?.settings;
  const comingNext = () => hud.show(t("common.comingNext"));
  const open = (path: string) => () => push(`/setup/${venueId}/${path}`);
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
    is(RULES.customers) && {
      key: "customers",
      title: t(`${v}.customers`),
      body: t(`${v}.customersBody`),
      onPress: () => push("/customers"),
    },
    is(RULES.regulars) && {
      key: "regulars",
      title: t(`${v}.regulars`),
      body: regulars.data
        ? t(`${v}.weekly`, {
            count: regulars.data.filter((regular) => regular.status !== "ENDED").length,
          })
        : t(`${v}.regularsBody`),
      onPress: () => push("/regulars"),
    },
    is(RULES.team) && {
      key: "team",
      title: t(`${v}.team`),
      body: team,
      onPress: () => push("/team"),
    },
  ];
  const place = [
    is(RULES.venueForm) && {
      key: "profile",
      title: t(`${v}.profile`),
      body: photos.data
        ? t(`${v}.profileBody`, { count: ready.length })
        : t(`${v}.profileBodyPlain`),
      onPress: open("details"),
    },
    is(RULES.scheduleForm) && {
      key: "grounds",
      title: t(`${v}.grounds`),
      body:
        groundCount === undefined
          ? t(`${v}.groundsBodyPlain`)
          : t(`${v}.groundsBody`, { count: groundCount }),
      onPress: open("grounds"),
    },
    is(RULES.scheduleForm) && {
      key: "hours",
      title: t(`${v}.hours`),
      body: t(`${v}.hoursBody`),
      onPress: open("hours"),
    },
  ];
  const rules = [
    is(RULES.bookingSettings) && {
      key: "booking",
      title: t(`${v}.bookingSettings`),
      body: t(`${v}.bookingSettingsBody`),
      onPress: open("settings/booking"),
    },
    is(RULES.venueForm) && {
      key: "payments",
      title: t(`${v}.payments`),
      body: settings ? payment(t, settings) : t(`${v}.paymentsBody`),
      // Without its cancellation policy: the Venue tab has a row of its own for that.
      onPress: open("settings?from=venue"),
    },
    is(RULES.venueForm) && {
      key: "cancellations",
      title: t(`${v}.cancellations`),
      body: settings?.cancellationPolicy
        ? t(`screens.setup.settings.cancellation.policies.${settings.cancellationPolicy}.title`)
        : t(`${v}.cancellationsBody`),
      onPress: open("settings/cancellation"),
    },
  ];

  const group = (heading: string, rows: (false | Row)[], first = false) => {
    const shown = rows.filter((row): row is Row => row !== false);
    if (shown.length === 0) return null;
    return (
      <>
        {/* Not told to the bar: it stays plain all the way down (user, 2026-11-26). */}
        <SettingsHeading first={first} tight={first}>
          {heading}
        </SettingsHeading>
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
      <PinnedTitle sections={sections}>
        {/* A hairline under the bar, not a fade. */}
        <FadingScroll scrollY={sections.scrollY} topLine={false}>
          <Title>{t(`${v}.title`)}</Title>
          <View className="mt-3 overflow-hidden rounded-[20px]" style={{ height: COVER_HEIGHT }}>
            {ready.length > 0 ? (
              <CoverPhotos urls={ready.map((photo) => photo.url)} />
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

          {group(t(`${v}.details`), place, true)}
          {group(t(`${v}.peopleHeading`), people, !place.some(Boolean))}
          {group(t(`${v}.rules`), rules)}

          {/* Taking bookings or paused (user, 2026-11-27): the switch takes the tap, greyed, and the
              sheet asks; only `venue: manage` can change it. */}
          {can("venue") ? (
            <>
              <SettingsHeading>{t(`${v}.availability`)}</SettingsHeading>
              <SettingsRow
                title={t(`${v}.taking`)}
                body={live ? t(`${v}.takingOn`) : t(`${v}.takingOff`)}
                divider={false}
                trailing={
                  <Switch
                    accessibilityLabel={t(`${v}.taking`)}
                    value={asked === null ? live : asked === "resume"}
                    disabled={asked !== null || venue.permissions.venue !== "manage"}
                    onValueChange={(on) => {
                      setAsked(on ? "resume" : "pause");
                      setAsking(true);
                    }}
                    trackColor={{ true: colors.primary }}
                  />
                }
              />
            </>
          ) : null}
        </FadingScroll>
      </PinnedTitle>
      {asked ? (
        <VenuePauseSheet
          venueId={venueId}
          name={venue.name ?? ""}
          action={asked}
          visible={asking}
          onClose={() => setAsking(false)}
          // Gone: the switch shows what's saved again (the new status once read, else as it was).
          onHidden={() => setAsked(null)}
        />
      ) : null}
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

// The venue's photos in turn, the next fading in every 5 seconds while the tab is in view (and
// back to the first after the last). Grey and pulsing until the first has come. Each is fetched
// ahead, so the next is ready to fade to; through reachable() (the dev API's host as the phone
// sees it), filling the space, with no blurry preview.
function CoverPhotos({ urls }: { urls: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const sources = urls.map(reachable);
  const key = sources.join(" ");

  useEffect(() => {
    void Image.prefetch(key.split(" "));
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      if (urls.length < 2) return;
      const timer = setInterval(() => setIndex((at) => at + 1), PHOTO_MS);
      return () => clearInterval(timer);
    }, [urls.length]),
  );

  const uri = sources[index % sources.length] ?? sources[0];
  return (
    <>
      {shown ? null : <Bone className="absolute inset-0" />}
      <Image
        source={{ uri }}
        contentFit="cover"
        transition={{ duration: FADE_MS, effect: "cross-dissolve" }}
        onLoad={() => setShown(true)}
        style={{ width: "100%", height: "100%" }}
        accessibilityIgnoresInvertColors
      />
    </>
  );
}
