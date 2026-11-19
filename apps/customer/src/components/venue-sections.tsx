import type { ReactNode } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { formatPrice } from "@/lib/money";
import { COUNTRY_CODE, displayPhone, PHONE_DIGITS } from "@/lib/phone";
import {
  cheapestHour,
  dayLabel,
  freeCancellationHours,
  groundLine,
  kindOf,
  noticeLabel,
  paymentLabel,
  sportsLine,
  startTimes,
  timeOfDay,
  type PublicVenue,
  type VenueAvailability,
} from "@/lib/venue";
import { colors } from "@/lib/colors";
import { AmenityIcon } from "./amenity-icon";
import { IconStarFilled } from "./icons";
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

// Name, where it is, what's played, and its rating.
export function VenueHeader({ venue }: { venue: PublicVenue }) {
  const place = [venue.location.area, sportsLine(venue)].filter(Boolean).join(" · ");
  return (
    <View className="gap-1.5 px-6 pt-5">
      <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
        {venue.name ?? "Venue"}
      </Text>
      {place ? <Text className="text-body text-ink-2">{place}</Text> : null}
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

// Three big figures: the cheapest hour, how many grounds, how long cancelling stays free.
export function Figures({ venue }: { venue: PublicVenue }) {
  const cheapest = cheapestHour(venue);
  const free = freeCancellationHours(venue);
  const figures = [
    {
      value: cheapest === null ? "—" : formatPrice(cheapest, venue.marketplace.currency),
      label: "from, per hour",
    },
    {
      value: String(venue.grounds.length),
      label: venue.grounds.length === 1 ? "ground" : "grounds",
    },
    {
      value: free === null ? "None" : `${free} h`,
      label: "free cancellation",
    },
  ];
  return (
    <View className="mx-6 mt-5 flex-row border-y border-border py-4">
      {figures.map((figure, index) => (
        <View
          key={figure.label}
          className={`flex-1 gap-0.5 ${index > 0 ? "border-l border-border pl-4" : ""}`}
        >
          <Text className="text-[20px] leading-[26px] font-medium">{figure.value}</Text>
          <Text className="text-caption text-unit">{figure.label}</Text>
        </View>
      ))}
    </View>
  );
}

// Today's start times per ground, as chips (Fresha's results), or tomorrow's once today has none
// left. Tapping one is where booking will start.
export function FreeToday({
  venue,
  availability,
  onPick,
}: {
  venue: PublicVenue;
  availability: VenueAvailability | null;
  onPick: () => void;
}) {
  if (venue.status === "MAINTENANCE") {
    return (
      <View className="gap-2 px-6 pt-6">
        <GroupHeading>Paused for now</GroupHeading>
        <Text className="text-body text-ink-2">
          The venue isn’t taking bookings at the moment. Bookings already made still stand.
        </Text>
      </View>
    );
  }
  const timezone = venue.marketplace.timezone;
  const rows = venue.grounds
    .filter((ground) => ground.status === "ACTIVE")
    .map((ground) => ({
      ground,
      starts: availability ? startTimes(availability.slots, ground) : [],
    }))
    .filter((row) => row.starts.length > 0);

  return (
    <View className="gap-4 pt-6">
      <View className="px-6">
        <GroupHeading
          action={
            availability ? (
              <Text className="text-label text-ink-2">{dayLabel(availability.date)}</Text>
            ) : undefined
          }
        >
          {!availability || availability.date === availability.days.first
            ? "Free today"
            : "Free tomorrow"}
        </GroupHeading>
      </View>
      {rows.length === 0 ? (
        <Text className="px-6 text-body text-ink-2">
          {availability ? "Nothing left today or tomorrow." : "Couldn’t load today’s times."}
        </Text>
      ) : (
        rows.map(({ ground, starts }, index) => (
          <View key={ground.id} className="gap-2.5">
            {index > 0 ? (
              <View className="mx-6 mb-2">
                <Hairline />
              </View>
            ) : null}
            <View className="flex-row items-center justify-between px-6">
              <Text className="text-subtitle font-medium">
                {ground.name ?? kindOf(ground)}{" "}
                <Text className="text-subtitle text-ink-2">· {kindOf(ground)}</Text>
              </Text>
              {ground.priceFrom !== null ? (
                <Text className="text-label text-ink-2">
                  from {formatPrice(ground.priceFrom, venue.marketplace.currency)}
                </Text>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-6"
            >
              {starts.map((slot) => (
                <Pressable
                  key={slot.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${ground.name ?? kindOf(ground)} at ${timeOfDay(slot.startsAt, timezone)}`}
                  onPress={onPick}
                  className="h-9 items-center justify-center rounded-full border border-border px-3.5 active:bg-chip"
                >
                  <Text className="text-body font-medium">
                    {timeOfDay(slot.startsAt, timezone)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))
      )}
    </View>
  );
}

export function GroundsSection({
  venue,
  onLayout,
}: {
  venue: PublicVenue;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  return (
    <Section title="The grounds" onLayout={onLayout}>
      {venue.layout ? (
        <VenueLayout layout={venue.layout} grounds={venue.grounds} amenities={venue.amenities} />
      ) : null}
      <Rows>
        {venue.grounds.map((ground) => (
          <View key={ground.id} className="flex-row items-center justify-between gap-3 py-3.5">
            <View className="shrink gap-0.5">
              <Text className="text-subtitle font-medium">{ground.name ?? kindOf(ground)}</Text>
              <Text className="text-label text-ink-2">{groundLine(ground)}</Text>
            </View>
            {ground.status === "MAINTENANCE" ? (
              <Text className="text-label text-unit">Closed for now</Text>
            ) : ground.priceFrom !== null ? (
              <Text className="text-label font-medium">
                {formatPrice(ground.priceFrom, venue.marketplace.currency)}
                <Text className="text-label text-ink-2">/hr</Text>
              </Text>
            ) : null}
          </View>
        ))}
      </Rows>
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
    facts.push({
      label: "Regulars",
      value: `1 free after ${booking.loyalty.stamps} bookings`,
    });
  }
  const summary = booking.cancellation?.summary ?? [];
  // The last line is the venue's own promise (a full refund if it cancels): a note, not a rule.
  const rules = summary.slice(0, -1);
  const note = summary.at(-1);
  return (
    <>
      <Section title="How booking works" onLayout={onLayout}>
        <Rows>
          {facts.map((fact) => (
            <FactRow key={fact.label} {...fact} />
          ))}
        </Rows>
      </Section>
      {rules.length > 0 ? (
        <Section title="If you cancel">
          <Rows>
            {rules.map((line) => (
              <Text key={line} className="py-3.5 text-body">
                {line}
              </Text>
            ))}
          </Rows>
          {note ? <Text className="text-label text-unit">{note}</Text> : null}
        </Section>
      ) : null}
    </>
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
            <Text className="text-body">
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

// "+20 100 123 4567" for a mobile in the app's country; anything else (a landline) as stored.
const readablePhone = (e164: string) => {
  const local = e164.startsWith(COUNTRY_CODE) ? e164.slice(COUNTRY_CODE.length) : null;
  return local && local.length === PHONE_DIGITS ? displayPhone(local) : e164;
};

// Opens the phone's maps app with directions to the venue.
const openDirections = (latitude: number, longitude: number, name: string) => {
  const label = encodeURIComponent(name);
  void Linking.openURL(
    Platform.OS === "ios"
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  );
};

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
      <Rows>
        {[
          <View key="address" className="flex-row items-center justify-between gap-4 py-3.5">
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
          </View>,
          ...(venue.phone
            ? [
                <View key="phone" className="flex-row items-center justify-between gap-4 py-3.5">
                  <View className="gap-0.5">
                    <Text className="text-subtitle font-medium">{readablePhone(venue.phone)}</Text>
                    <Text className="text-label text-ink-2">The venue’s phone</Text>
                  </View>
                  <Link label="Call" onPress={() => void Linking.openURL(`tel:${venue.phone}`)} />
                </View>,
              ]
            : []),
        ]}
      </Rows>
    </Section>
  );
}
