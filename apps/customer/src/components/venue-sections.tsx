import { refundBands } from "@hagz/contracts";
import type { Icon } from "@tabler/icons-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import MapView, { Marker } from "react-native-maps";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/lib/colors";
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
import { IconBolt, IconCalendarX, IconCash, IconClock, IconStarFilled } from "./icons";
import { Text } from "./text";
import { VenueLayout } from "./venue-layout";

// The venue page's parts (Figma C5, frames 59:2 and 60:2), top to bottom. Rows follow Public's
// pattern: grey label on the left, the value on the right, hairlines between.

export const Hairline = () => <View className="h-px bg-border" />;

export function GroupHeading({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text accessibilityRole="header" className="text-[18px] leading-6 font-semibold">
        {children}
      </Text>
      {action}
    </View>
  );
}

// A section of the scroll, which reports where it starts so the tabs can scroll to it.
export function Section({
  title,
  action,
  onLayout,
  children,
}: {
  title: string;
  action?: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  return (
    <View className="gap-4 px-6 pt-8" onLayout={onLayout}>
      <GroupHeading action={action}>{title}</GroupHeading>
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
  onTitleLayout,
}: {
  venue: PublicVenue;
  onTitleLayout: (event: LayoutChangeEvent) => void;
}) {
  const sports = sportsLine(venue);
  return (
    <View className="gap-1.5 px-6 pt-7">
      <Text
        accessibilityRole="header"
        className="text-title font-semibold tracking-[-0.4px]"
        onLayout={onTitleLayout}
      >
        {venue.name ?? "Venue"}
      </Text>
      {venue.location.area ? (
        <Text className="text-body text-ink-2">{venue.location.area}</Text>
      ) : null}
      {sports ? <Text className="text-body text-ink-2">{sports}</Text> : null}
      <View className="mt-1 flex-row items-center gap-1.5">
        {venue.rating.average !== null ? (
          <>
            <IconStarFilled size={15} color={colors.ink} />
            <Text className="text-body font-medium">{venue.rating.average.toFixed(2)}</Text>
            <Text className="text-body text-ink-2">·</Text>
            <Text className="text-body text-ink-2">
              {venue.rating.count} {venue.rating.count === 1 ? "review" : "reviews"}
            </Text>
          </>
        ) : (
          <Text className="text-body text-ink-2">No reviews yet</Text>
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
          title: "Instant confirmation",
          line: "No waiting for the venue to accept.",
        }
      : { icon: IconClock, title: "Confirmed by the venue", line: "They accept each booking." },
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
            ? `Free cancellation up to ${hoursLabel(first.from)} before`
            : `${first.refundPercent}% back up to ${hoursLabel(first.from)} before`,
        line:
          next && next.refundPercent > 0
            ? `${next.refundPercent}% back up to ${hoursLabel(next.from)} before.`
            : "No refund after that.",
      });
    }
  }
  const { payment } = booking;
  rows.push(
    payment.mode === "DEPOSIT"
      ? {
          icon: IconCash,
          title: `${payment.depositPercent ?? 0}% online deposit`,
          line: "The rest at the venue.",
        }
      : payment.mode === "PLATFORM"
        ? { icon: IconCash, title: "Pay online", line: "In full when you book." }
        : { icon: IconCash, title: "Pay at the venue", line: "In cash, when you play." },
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
  if (ground.status === "MAINTENANCE") {
    return <Text className="text-label text-unit">Closed for now</Text>;
  }
  if (ground.priceFrom === null) return null;
  return (
    <Text className="text-subtitle font-medium">
      {formatPrice(ground.priceFrom, currency)}
      <Text className="text-subtitle text-ink-2">/hr</Text>
    </Text>
  );
}

// How long a booking there can be: "Book 1 hour", "Book 1–2 hours".
const lengthLabel = (ground: PublicGround) =>
  ground.minimumSlots === ground.maximumSlots
    ? `Book ${hoursLabel(ground.minimumSlots)}`
    : `Book ${ground.minimumSlots}–${ground.maximumSlots} hours`;

// A ground's card in the row under the map (Figma C5 round 3, option 5, 86:2): name and price, what
// it is, how long a booking can be, and a See times button across the bottom. Picking only fades
// things: the black border over the grey one (which stays, so an unpicked card keeps its 1px edge)
// and the button from grey to black. Nothing changes size, so nothing moves.
function GroundOption({
  ground,
  width,
  currency,
  picked,
  onPick,
  onSeeTimes,
}: {
  ground: PublicGround;
  width: number;
  currency: string;
  picked: boolean;
  onPick: () => void;
  onSeeTimes: () => void;
}) {
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
      style={{ width }}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-px rounded-[17px] border-[1.5px] border-ink"
        style={fade}
      />
      <View className="flex-row items-center justify-between gap-6">
        <Text className="shrink text-subtitle font-medium" numberOfLines={1}>
          {ground.name ?? kindOf(ground)}
        </Text>
        <GroundPrice ground={ground} currency={currency} />
      </View>
      <Text className="text-label text-ink-2">{groundLine(ground)}</Text>
      {bookable ? <Text className="text-label text-ink-2">{lengthLabel(ground)}</Text> : null}
      {bookable ? (
        // On every card: grey, and black once it's the picked one, the black laid over the grey
        // and faded in. Pressed on a card that isn't picked, it picks it too.
        <View className="mt-auto pt-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`See times for ${ground.name ?? kindOf(ground)}`}
            onPress={() => {
              if (!picked) onPick();
              onSeeTimes();
            }}
            className="h-10 items-center justify-center rounded-full bg-chip active:opacity-80"
          >
            <Text className="text-body font-semibold">See times</Text>
            <Animated.View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center rounded-full bg-ink"
              style={fade}
            >
              <Text className="text-body font-semibold text-white">See times</Text>
            </Animated.View>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
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
}: {
  venue: PublicVenue;
  onLayout: (event: LayoutChangeEvent) => void;
  onSeeTimes: () => void;
}) {
  const { width: screen } = useWindowDimensions();
  const card = Math.round(screen * CARD_SHARE);
  const step = card + CARD_GAP;
  // Where the row stops for each card: its left edge on the page's gutter, except at the end,
  // where the last card's right edge meets the gutter on the other side.
  const count = venue.grounds.length;
  const end = Math.max(0, 2 * GUTTER + count * card + (count - 1) * CARD_GAP - screen);
  const stops = venue.grounds.map((_, index) => Math.min(index * step, end));
  const first = Math.max(
    0,
    venue.grounds.findIndex((ground) => ground.status === "ACTIVE"),
  );
  const [pickedId, setPickedId] = useState<string | null>(venue.grounds[first]?.id ?? null);
  const row = useRef<ScrollViewInstance>(null);
  const currency = venue.marketplace.currency;

  // The card that settles in place is the picked one, so the map follows the swipe; tapping a
  // card brings it into place.
  // The card whose stop is nearest; at the end, where several may share it, the last of them.
  const settle = (x: number) => {
    let index = 0;
    stops.forEach((stop, i) => {
      if (Math.abs(stop - x) <= Math.abs((stops[index] ?? 0) - x)) index = i;
    });
    const ground = venue.grounds[index];
    if (ground) setPickedId(ground.id);
  };
  const bringIn = (index: number) => {
    row.current?.scrollTo({ x: stops[index] ?? 0, animated: true });
    const ground = venue.grounds[index];
    if (ground) setPickedId(ground.id);
  };

  return (
    <Section title="Grounds" onLayout={onLayout}>
      {venue.layout ? (
        <VenueLayout
          layout={venue.layout}
          grounds={venue.grounds}
          amenities={venue.amenities}
          selectedId={pickedId}
        />
      ) : null}
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
            onPick={() => bringIn(index)}
            onSeeTimes={onSeeTimes}
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
  const { booking } = venue;
  const facts = [
    {
      label: "Confirmation",
      value: booking.instantConfirmation ? "Instant" : "The venue confirms",
    },
    { label: "Book up to", value: noticeLabel(booking.minimumNotice) },
    { label: "Payment", value: paymentLabel(booking.payment) },
  ];
  if (booking.loyalty) {
    facts.push({ label: "Loyalty", value: `1 free after ${booking.loyalty.stamps} bookings` });
  }
  return (
    <Section title="How booking works" onLayout={onLayout}>
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
    ? `${hoursLabel(from)} or more`
    : from === 0
      ? `Under ${hoursLabel(to)}`
      : `${from} to ${hoursLabel(to)}`;

// The policy as a table: how much notice, and how much comes back (the same bands the server's
// plain-words summary is written from). A venue cancelling always refunds in full.
export function CancellationSection({ venue }: { venue: PublicVenue }) {
  const cancellation = venue.booking.cancellation;
  if (!cancellation) return null;
  const bands = refundBands(cancellation.tiers);
  return (
    <Section title="Cancellation policy">
      <View className="overflow-hidden rounded-field border border-border">
        <View className="flex-row items-center justify-between bg-chip px-4 py-2.5">
          <Text className="text-caption font-medium text-ink-2">Cancel before it starts</Text>
          <Text className="text-caption font-medium text-ink-2">You get back</Text>
        </View>
        {bands.map((band, index) => (
          <View key={band.from}>
            {index > 0 ? <Hairline /> : null}
            <View className="flex-row items-center justify-between gap-4 px-4 py-3.5">
              <Text className="text-body">{bandLabel(band.from, band.to)}</Text>
              <Text className={`text-body ${band.refundPercent > 0 ? "font-medium" : "text-unit"}`}>
                {band.refundPercent === 100
                  ? "Everything"
                  : band.refundPercent === 0
                    ? "Nothing"
                    : `${band.refundPercent}%`}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text className="text-label text-unit">If the venue cancels, you get everything back.</Text>
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
  return (
    <Section title="What’s here" onLayout={onLayout}>
      <View className="flex-row flex-wrap gap-2">
        {venue.amenities.map((amenity) => (
          <View
            key={amenity.id}
            className="h-[38px] flex-row items-center gap-2 rounded-full bg-chip px-3.5"
          >
            <AmenityIcon name={amenity.icon} size={18} color={colors.ink} />
            <Text className="text-body font-medium">
              {amenity.name}
              {amenity.price !== null ? (
                <Text className="text-body text-ink-2">
                  {" · "}
                  {formatPrice(amenity.price, venue.marketplace.currency)}
                  {amenity.pricing === "PER_HOUR" ? "/hr" : ""}
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
  return (
    <Section title="About">
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
  return (
    <Section title="Reviews" onLayout={onLayout}>
      {venue.rating.average !== null ? (
        <View className="flex-row items-end gap-3">
          <Text className="text-[40px] leading-[44px] font-medium tracking-[-0.6px]">
            {venue.rating.average.toFixed(2)}
          </Text>
          <Text className="pb-1.5 text-label text-ink-2">
            from {venue.rating.count} {venue.rating.count === 1 ? "player" : "players"}
          </Text>
        </View>
      ) : (
        <Text className="text-body text-ink-2">
          No reviews yet. Players can review a venue after they’ve played there.
        </Text>
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
  onLayout,
}: {
  venue: PublicVenue;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { coordinates, address, area } = venue.location;
  return (
    <Section title="Where it is" onLayout={onLayout}>
      {coordinates ? (
        <View className="h-[180px] overflow-hidden rounded-2xl" pointerEvents="none">
          <MapView
            style={{ flex: 1 }}
            initialRegion={{ ...coordinates, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          >
            <Marker coordinate={coordinates} anchor={{ x: 0.5, y: 0.5 }}>
              <View className="size-9 items-center justify-center rounded-full bg-ink">
                <View className="size-3 rounded-full bg-primary" />
              </View>
            </Marker>
          </MapView>
        </View>
      ) : null}
      <View className="flex-row items-center justify-between gap-4">
        <View className="shrink gap-0.5">
          <Text className="text-subtitle font-medium">
            {address ?? area ?? "Address not given"}
          </Text>
          {address && area ? <Text className="text-label text-ink-2">{area}</Text> : null}
        </View>
        {coordinates ? (
          <Link
            label="Directions"
            onPress={() =>
              openDirections(coordinates.latitude, coordinates.longitude, venue.name ?? "")
            }
          />
        ) : null}
      </View>
    </Section>
  );
}
