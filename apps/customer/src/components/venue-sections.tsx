import { refundBands } from "@hagz/contracts";
import type { Icon } from "@tabler/icons-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SvgXml } from "react-native-svg";
import { MAP_PIN, MAP_PIN_SIZE } from "@/assets/map-art";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import i18n from "@/i18next/i18next";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import {
  groundLine,
  hoursLabel,
  kindOf,
  noticeLabel,
  paymentLabel,
  sportsLine,
  type PublicGround,
  type PublicVenue,
} from "@/lib/venue";
import { AmenityIcon } from "./amenity-icon";
import {
  IconArrowRight,
  IconBolt,
  IconCalendarX,
  IconCash,
  IconClock,
  IconStarFilled,
} from "./icons";
import { Text } from "./text";

// The venue page's parts (Figma C5, frames 59:2 and 60:2), top to bottom. Rows follow Public's
// pattern: grey label at the start, the value at the end, hairlines between (mirrored in Arabic).

export const Hairline = () => <View className="h-px bg-border" />;

export function GroupHeading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="text-[18px] leading-6 font-semibold">
      {children}
    </Text>
  );
}

// A section of the scroll, which reports where it starts so the tabs can scroll to it.
export function Section({
  title,
  note,
  action,
  onLayout,
  children,
}: {
  title: string;
  // A small grey line under the heading (what the grounds were matched against).
  note?: string;
  // At the end, centred on the heading and its note together (View layout).
  action?: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  return (
    <View className="gap-4 px-6 pt-8" onLayout={onLayout}>
      <View className="flex-row items-center gap-4">
        <View className="flex-1 gap-1">
          <GroupHeading>{title}</GroupHeading>
          {note ? <Text className="text-caption text-ink-2">{note}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function Rows({ children }: { children: ReactNode[] }) {
  return (
    <View>
      {children.map((child, index) => (
        <View key={index}>
          {index > 0 ? <Hairline /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-3.5">
      <Text className="text-body text-ink-2">{label}</Text>
      <Text className="shrink text-right text-body font-medium">{value}</Text>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={10}
      onPress={onPress}
      className="active:opacity-60"
    >
      <Text className="text-body font-medium underline">{label}</Text>
    </Pressable>
  );
}

// Name, where it is, what's played, and its rating. `onTitleLayout` says where the name sits, so
// the bar can show it once it has scrolled under.
export function VenueHeader({
  venue,
  distance,
  onTitleLayout,
}: {
  venue: PublicVenue;
  // How far it is from the player ("5.5 km"), when the phone knows.
  distance: string | null;
  onTitleLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  const sports = sportsLine(venue);
  return (
    <View className="gap-1.5 px-6 pt-7">
      <Text
        accessibilityRole="header"
        className="text-title font-semibold tracking-[-0.4px]"
        onLayout={onTitleLayout}
      >
        {venue.name ?? t("screens.venue.fallbackName")}
      </Text>
      {venue.location.area ? (
        <Text className="text-body text-ink-2">
          {venue.location.area}
          {distance ? ` (${distance})` : ""}
        </Text>
      ) : null}
      {sports ? <Text className="text-body text-ink-2">{sports}</Text> : null}
      <View className="mt-1 flex-row items-center gap-1.5">
        {venue.rating.average !== null ? (
          <>
            <IconStarFilled size={15} color={colors.ink} />
            <Text className="text-body font-medium">{venue.rating.average.toFixed(2)}</Text>
            <Text className="text-body text-ink-2">·</Text>
            <Text className="text-body text-ink-2">
              {t("screens.venue.reviews", { count: venue.rating.count })}
            </Text>
          </>
        ) : (
          <Text className="text-body text-ink-2">{t("screens.venue.noReviews")}</Text>
        )}
      </View>
    </View>
  );
}

// What booking here is like, in three rows under the name (Airbnb's listing highlights, the user's
// pick on 2026-11-19): how it's confirmed, how long cancelling is free, and how you pay.
const highlightsOf = (venue: PublicVenue) => {
  const { booking } = venue;
  const rows: { icon: Icon; title: string; line: string }[] = [
    booking.instantConfirmation
      ? {
          icon: IconBolt,
          title: i18n.t("screens.venue.highlights.instant"),
          line: i18n.t("screens.venue.highlights.instantLine"),
        }
      : {
          icon: IconClock,
          title: i18n.t("screens.venue.highlights.venueConfirms"),
          line: i18n.t("screens.venue.highlights.venueConfirmsLine"),
        },
  ];
  const cancellation = booking.cancellation;
  if (cancellation) {
    const bands = refundBands(cancellation.tiers);
    const [first, next] = bands;
    if (first && first.refundPercent > 0) {
      rows.push({
        icon: IconCalendarX,
        title:
          first.refundPercent === 100
            ? i18n.t("screens.venue.highlights.freeCancellation", {
                hours: hoursLabel(first.from),
              })
            : i18n.t("screens.venue.highlights.partBack", {
                percent: first.refundPercent,
                hours: hoursLabel(first.from),
              }),
        line:
          next && next.refundPercent > 0
            ? i18n.t("screens.venue.highlights.nextBack", {
                percent: next.refundPercent,
                hours: hoursLabel(next.from),
              })
            : i18n.t("screens.venue.highlights.noRefundAfter"),
      });
    }
  }
  const { payment } = booking;
  rows.push(
    payment.mode === "DEPOSIT"
      ? {
          icon: IconCash,
          title: i18n.t("screens.venue.highlights.deposit", {
            percent: payment.depositPercent ?? 0,
          }),
          line: i18n.t("screens.venue.highlights.depositLine"),
        }
      : payment.mode === "PLATFORM"
        ? {
            icon: IconCash,
            title: i18n.t("screens.venue.highlights.payOnline"),
            line: i18n.t("screens.venue.highlights.payOnlineLine"),
          }
        : {
            icon: IconCash,
            title: i18n.t("screens.venue.highlights.payAtVenue"),
            line: i18n.t("screens.venue.highlights.payAtVenueLine"),
          },
  );
  return rows;
};

export function Highlights({ venue }: { venue: PublicVenue }) {
  return (
    <View className="mx-6 mt-6 gap-4 border-y border-border py-4">
      {highlightsOf(venue).map(({ icon: Glyph, title, line }) => (
        <View key={title} className="flex-row items-start gap-3">
          <Glyph size={20} color={colors.ink} strokeWidth={1.75} />
          <View className="shrink">
            <Text className="text-body font-medium">{title}</Text>
            <Text className="text-caption text-ink-2">{line}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// A ground's hourly price, or that it's closed.
function GroundPrice({ ground, currency }: { ground: PublicGround; currency: string }) {
  const { t } = useTranslation();
  if (ground.status === "MAINTENANCE") {
    return <Text className="text-label text-unit">{t("screens.venue.grounds.closed")}</Text>;
  }
  if (ground.priceFrom === null) return null;
  return (
    <Text className="text-subtitle font-medium">
      {formatPrice(ground.priceFrom, currency)}
      <Text className="text-subtitle text-ink-2">{t("formats.perHour")}</Text>
    </Text>
  );
}

// How long a booking there can be: "Book 1 hour", "Book 1–2 hours".
const lengthLabel = (ground: PublicGround) =>
  ground.minimumSlots === ground.maximumSlots
    ? i18n.t("screens.venue.grounds.book", { hours: hoursLabel(ground.minimumSlots) })
    : i18n.t("screens.venue.grounds.bookRange", {
        min: ground.minimumSlots,
        max: ground.maximumSlots,
      });

// A ground's card in the row under the map (Figma C5 round 3, option 5, 86:2): name and price, what
// it is, how long a booking can be, and a See times button across the bottom. Picking only fades
// things: a slightly darker grey border over the light one (which stays, so an unpicked card keeps its 1px
// edge) and the button from grey to lime (user, 2026-11-20). Nothing changes size, so nothing moves.
function GroundOption({
  ground,
  width,
  currency,
  picked,
  unavailable = false,
  onPick,
  onSeeTimes,
}: {
  ground: PublicGround;
  width: number;
  currency: string;
  picked: boolean;
  // Not what the search asked for (lib/ground-filter.ts): greyed out, still there to look at.
  unavailable?: boolean;
  onPick: () => void;
  onSeeTimes: () => void;
}) {
  const { t } = useTranslation();
  const shown = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(picked ? 1 : 0, { duration: 200 });
  }, [picked, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  const bookable = ground.status === "ACTIVE";
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: picked }}
      onPress={onPick}
      className="gap-0.5 rounded-2xl border border-border px-4 py-4"
      style={{ width, opacity: unavailable ? 0.45 : 1 }}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-px rounded-[17px] border-[1.5px] border-[#d5d8dd]"
        style={fade}
      />
      <View className="flex-row items-center justify-between gap-6">
        <Text className="shrink text-subtitle font-medium" numberOfLines={1}>
          {ground.name ?? kindOf(ground)}
        </Text>
        <GroundPrice ground={ground} currency={currency} />
      </View>
      <Text className="text-label text-ink-2">{groundLine(ground)}</Text>
      {unavailable ? (
        <Text className="text-label font-medium text-ink-2">
          {t("screens.venue.filter.unavailable")}
        </Text>
      ) : bookable ? (
        <Text className="text-label text-ink-2">{lengthLabel(ground)}</Text>
      ) : null}
      {bookable ? (
        // On every card: grey, and lime once it's the picked one, the lime laid over the grey and
        // faded in. Pressed on a card that isn't picked, it picks it too.
        <View className="mt-auto pt-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("screens.venue.grounds.seeTimesFor", {
              name: ground.name ?? kindOf(ground),
            })}
            onPress={() => {
              if (!picked) onPick();
              onSeeTimes();
            }}
            className="h-10 items-center justify-center rounded-full bg-chip active:opacity-80"
          >
            <SeeTimesLabel />
            {/* Unavailable for the search: grey even when picked, the lime kept for a fit. */}
            {unavailable ? null : (
              <Animated.View
                pointerEvents="none"
                className="absolute inset-0 items-center justify-center rounded-full bg-primary"
                style={fade}
              >
                <SeeTimesLabel />
              </Animated.View>
            )}
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

// "See times →", in ink on both the grey button and the lime one. The arrow points forward: left
// in Arabic.
function SeeTimesLabel() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-body font-semibold">{t("screens.venue.grounds.seeTimes")}</Text>
      <IconArrowRight
        size={16}
        color={colors.ink}
        strokeWidth={2.25}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </View>
  );
}

// Which card is in place, out of how many: a short pill for it, dots for the rest.
function PageDots({ count, current }: { count: number; current: number }) {
  if (count < 2) return null;
  return (
    <View className="flex-row items-center justify-center gap-1.5" accessible={false}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className={`h-1.5 rounded-full ${index === current ? "w-3.5 bg-ink" : "w-1.5 bg-grab"}`}
        />
      ))}
    </View>
  );
}

// The cards: 80% of the screen, 10 apart, so the next one peeks in.
const CARD_SHARE = 0.8;
const CARD_GAP = 10;
const GUTTER = 24;

export function GroundsSection({
  venue,
  onLayout,
  onSeeTimes,
  onViewLayout,
  onPick,
  matches = null,
  note,
}: {
  venue: PublicVenue;
  onLayout: (event: LayoutChangeEvent) => void;
  // A ground's See times: its free hours (app/venue/[slug]/times.tsx).
  onSeeTimes: (groundId: string) => void;
  // View layout, at the end of the heading when the venue has drawn one: the map on its own screen
  // (app/venue/[slug]/layout.tsx).
  onViewLayout: () => void;
  // Which ground is picked now, for the Book button to open.
  onPick?: (groundId: string) => void;
  // Opened from a search: the grounds that fit it (the rest are greyed out), and what they were
  // matched against, under the heading. Null: no search.
  matches?: ReadonlySet<string> | null;
  note?: string;
}) {
  const { t } = useTranslation();
  const { width: screen } = useWindowDimensions();
  const card = Math.round(screen * CARD_SHARE);
  const step = card + CARD_GAP;
  // Where the row stops for each card: its left edge on the page's gutter, except at the end,
  // where the last card's right edge meets the gutter on the other side.
  const count = venue.grounds.length;
  const end = Math.max(0, 2 * GUTTER + count * card + (count - 1) * CARD_GAP - screen);
  const stops = venue.grounds.map((_, index) => Math.min(index * step, end));
  const firstOpen = (fits: (id: string) => boolean) =>
    venue.grounds.findIndex((ground) => ground.status === "ACTIVE" && fits(ground.id));
  const first = Math.max(
    0,
    firstOpen(() => true),
  );
  const [pickedId, setPickedId] = useState<string | null>(venue.grounds[first]?.id ?? null);
  const row = useRef<ScrollViewInstance>(null);
  const currency = venue.marketplace.currency;

  // The card that settles in place is the picked one; tapping a card brings it into place.
  // The card whose stop is nearest; at the end, where several may share it, the last of them.
  const settle = (x: number) => {
    let index = 0;
    stops.forEach((stop, i) => {
      if (Math.abs(stop - x) <= Math.abs((stops[index] ?? 0) - x)) index = i;
    });
    const ground = venue.grounds[index];
    if (ground) {
      setPickedId(ground.id);
      onPick?.(ground.id);
    }
  };
  const bringIn = (index: number) => {
    row.current?.scrollTo({ x: stops[index] ?? 0, animated: true });
    const ground = venue.grounds[index];
    if (ground) {
      setPickedId(ground.id);
      onPick?.(ground.id);
    }
  };
  // Once the search's matches are known: the first ground that fits comes into place, unless the
  // picked one already does.
  useEffect(() => {
    if (!matches || (pickedId && matches.has(pickedId))) return;
    const index = firstOpen((id) => matches.has(id));
    if (index >= 0) bringIn(index);
    // Only when the matches arrive, not on every pick.
  }, [matches]);

  return (
    <Section
      title={t("screens.venue.grounds.title")}
      note={note}
      onLayout={onLayout}
      action={
        venue.layout ? (
          <Link label={t("screens.venue.grounds.viewLayout")} onPress={onViewLayout} />
        ) : undefined
      }
    >
      {/* Edge to edge, snapping each card to the page's gutter, the last one to the right gutter.
          All as tall as the tallest. */}
      <ScrollView
        ref={row}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToOffsets={[...new Set(stops)]}
        decelerationRate="fast"
        disableIntervalMomentum
        contentOffset={{ x: stops[first] ?? 0, y: 0 }}
        onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
        className="-mx-6"
        contentContainerStyle={{
          gap: CARD_GAP,
          paddingHorizontal: GUTTER,
        }}
      >
        {venue.grounds.map((ground, index) => (
          <GroundOption
            key={ground.id}
            ground={ground}
            width={card}
            currency={currency}
            picked={ground.id === pickedId}
            unavailable={matches !== null && !matches.has(ground.id)}
            onPick={() => bringIn(index)}
            onSeeTimes={() => onSeeTimes(ground.id)}
          />
        ))}
      </ScrollView>
      <PageDots
        count={venue.grounds.length}
        current={Math.max(
          0,
          venue.grounds.findIndex((ground) => ground.id === pickedId),
        )}
      />
    </Section>
  );
}

export function BookingSection({
  venue,
  onLayout,
}: {
  venue: PublicVenue;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  const { booking } = venue;
  const facts = [
    {
      label: t("screens.venue.booking.confirmation"),
      value: booking.instantConfirmation
        ? t("screens.venue.booking.instant")
        : t("screens.venue.booking.venueConfirms"),
    },
    { label: t("screens.venue.booking.bookUpTo"), value: noticeLabel(booking.minimumNotice) },
    { label: t("screens.venue.booking.payment"), value: paymentLabel(booking.payment) },
  ];
  if (booking.loyalty) {
    facts.push({
      label: t("screens.venue.booking.loyalty"),
      value: t("screens.venue.booking.loyaltyValue", { count: booking.loyalty.stamps }),
    });
  }
  return (
    <Section title={t("screens.venue.booking.title")} onLayout={onLayout}>
      <Rows>
        {facts.map((fact) => (
          <FactRow key={fact.label} {...fact} />
        ))}
      </Rows>
    </Section>
  );
}

// "24 hours or more", "6 to 24 hours", "Under 6 hours": a band of notice before the start.
const bandLabel = (from: number, to: number | null) =>
  to === null
    ? i18n.t("screens.venue.cancellation.orMore", { hours: hoursLabel(from) })
    : from === 0
      ? i18n.t("screens.venue.cancellation.under", { hours: hoursLabel(to) })
      : i18n.t("screens.venue.cancellation.between", { from, hours: hoursLabel(to) });

// The policy as a table: how much notice, and how much comes back (the same bands the server's
// plain-words summary is written from). A venue cancelling always refunds in full.
export function CancellationSection({ venue }: { venue: PublicVenue }) {
  const { t } = useTranslation();
  const cancellation = venue.booking.cancellation;
  if (!cancellation) return null;
  const bands = refundBands(cancellation.tiers);
  return (
    <Section title={t("screens.venue.cancellation.title")}>
      <View className="overflow-hidden rounded-field border border-border">
        <View className="flex-row items-center justify-between bg-chip px-4 py-2.5">
          <Text className="text-caption font-medium text-ink-2">
            {t("screens.venue.cancellation.before")}
          </Text>
          <Text className="text-caption font-medium text-ink-2">
            {t("screens.venue.cancellation.back")}
          </Text>
        </View>
        {bands.map((band, index) => (
          <View key={band.from}>
            {index > 0 ? <Hairline /> : null}
            <View className="flex-row items-center justify-between gap-4 px-4 py-3.5">
              <Text className="text-body">{bandLabel(band.from, band.to)}</Text>
              <Text className={`text-body ${band.refundPercent > 0 ? "font-medium" : "text-unit"}`}>
                {band.refundPercent === 100
                  ? t("screens.venue.cancellation.everything")
                  : band.refundPercent === 0
                    ? t("screens.venue.cancellation.nothing")
                    : t("formats.percent", { percent: band.refundPercent })}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text className="text-label text-unit">{t("screens.venue.cancellation.venueCancels")}</Text>
    </Section>
  );
}

export function AmenitiesSection({
  venue,
  onLayout,
}: {
  venue: PublicVenue;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <Section title={t("screens.venue.amenities")} onLayout={onLayout}>
      <View className="flex-row flex-wrap gap-2">
        {venue.amenities.map((amenity) => (
          <View
            key={amenity.id}
            className="h-8 flex-row items-center gap-1.5 rounded-full bg-chip px-3"
          >
            <AmenityIcon name={amenity.icon} size={16} color={colors.ink} />
            <Text className="text-label font-medium">
              {amenity.name}
              {amenity.price !== null ? (
                <Text className="text-label text-ink-2">
                  {" · "}
                  {formatPrice(amenity.price, venue.marketplace.currency)}
                  {amenity.pricing === "PER_HOUR" ? t("formats.perHour") : ""}
                </Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

export function AboutSection({ description }: { description: string }) {
  const { t } = useTranslation();
  return (
    <Section title={t("screens.venue.about")}>
      <Text className="text-body">{description}</Text>
    </Section>
  );
}

export function ReviewsSection({
  venue,
  onLayout,
}: {
  venue: PublicVenue;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <Section title={t("screens.venue.reviewsTitle")} onLayout={onLayout}>
      {venue.rating.average !== null ? (
        <View className="flex-row items-end gap-3">
          <Text className="text-[40px] leading-[44px] font-medium tracking-[-0.6px]">
            {venue.rating.average.toFixed(2)}
          </Text>
          <Text className="pb-1.5 text-label text-ink-2">
            {t("screens.venue.fromPlayers", { count: venue.rating.count })}
          </Text>
        </View>
      ) : (
        <Text className="text-body text-ink-2">{t("screens.venue.noReviewsBody")}</Text>
      )}
    </Section>
  );
}

// Opens the phone's maps app with directions to the venue.
const openDirections = (latitude: number, longitude: number, name: string) => {
  const label = encodeURIComponent(name);
  void Linking.openURL(
    Platform.OS === "ios"
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  );
};

// The map and address. No phone: players get the venue's number with a booking there.
export function WhereSection({
  venue,
  distance,
  onLayout,
}: {
  venue: PublicVenue;
  distance: string | null;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  const { coordinates, address, area } = venue.location;
  return (
    <Section title={t("screens.venue.where")} onLayout={onLayout}>
      {coordinates ? (
        <View className="h-[180px] overflow-hidden rounded-2xl" pointerEvents="none">
          <MapView
            // Google Maps on both platforms, as in the staff app (the key is built in for both).
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{ ...coordinates, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          >
            {/* Its point on the venue: anchored at the bottom middle. Drawn once, so the map
                doesn't keep re-rendering it. */}
            <Marker coordinate={coordinates} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
              <SvgXml xml={MAP_PIN} width={MAP_PIN_SIZE.width} height={MAP_PIN_SIZE.height} />
            </Marker>
          </MapView>
        </View>
      ) : null}
      <View className="flex-row items-center justify-between gap-4">
        <View className="shrink gap-0.5">
          <Text className="text-subtitle font-medium">
            {address ?? area ?? t("screens.venue.noAddress")}
          </Text>
          {address && area ? (
            <Text className="text-label text-ink-2">
              {area}
              {distance ? ` (${distance})` : ""}
            </Text>
          ) : null}
        </View>
        {coordinates ? (
          <Link
            label={t("screens.venue.directions")}
            onPress={() =>
              openDirections(coordinates.latitude, coordinates.longitude, venue.name ?? "")
            }
          />
        ) : null}
      </View>
    </Section>
  );
}
