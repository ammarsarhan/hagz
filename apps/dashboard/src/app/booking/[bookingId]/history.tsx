import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { components } from "@hagz/api";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { StepRail, type Step } from "@/components/step-rail";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { localDateOf } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { useNow } from "@/lib/use-now";
import { hoursSpan, relativeDay, sentenceTime } from "@/lib/when";
import { bookingKey, bookingQuery } from "./index";

// A booking's history (Figma D17 642:469): every change, who made it and when, oldest first, under
// its day. Each is a filled dot on the rail: what happened, then who (and anything they said) in
// grey, and its time. The booking's events come from its history, a page at a time, read to the
// end, and so do those of every booking it was moved or swapped from (a move makes a new booking,
// linked back by movedFrom), so the history starts where the booking did. Check-ins aren't events,
// so they're added from the booking's own check-in.

type Booking = components["schemas"]["StaffBookingDetail"];
type Event = components["schemas"]["BookingHistoryEvent"];

// A booking rarely has more than a handful of events, or moves; these cap what's read.
const MAX_PAGES = 10;
const MAX_LINKS = 10;

interface Link {
  booking: Booking;
  events: Event[];
}

// One booking's events, every page.
const historyOf = async (venueId: string, bookingId: string) => {
  const all: Event[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await send(
      api.GET("/v1/staff/venues/{venueId}/bookings/{bookingId}/history", {
        params: { path: { venueId, bookingId }, query: { limit: 100, cursor } },
      }),
    );
    if (!result.ok) throw result.error;
    all.push(...result.data.data);
    if (!result.data.nextCursor) return all;
    cursor = result.data.nextCursor;
  }
  return all;
};

interface Entry {
  at: string;
  label: string;
  detail?: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function BookingHistory() {
  const { t } = useTranslation();
  const { bookingId = "" } = useLocalSearchParams<{ bookingId: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const compact = useCompactTitle();
  const booking = useQuery(bookingQuery(venueId, bookingId));
  // The booking and every one it was moved or swapped from, newest first, each with its events.
  const chain = useQuery({
    queryKey: [...bookingKey(venueId, bookingId), "history", "chain"],
    queryFn: async () => {
      const links: Link[] = [];
      let id: string | null = bookingId;
      while (id && links.length < MAX_LINKS) {
        const [detail, events]: [Booking, Event[]] = await Promise.all([
          bookingQuery(venueId, id).queryFn(),
          historyOf(venueId, id),
        ]);
        links.push({ booking: detail, events });
        id = detail.movedFrom?.bookingId ?? null;
      }
      return links;
    },
    enabled: venueId !== "" && bookingId !== "",
  });

  if (!booking.data) return <SetupLoading query={booking} />;
  if (!chain.data) return <SetupLoading query={chain} />;
  const { timezone } = booking.data;
  const entries = [
    ...chain.data.flatMap((link, index) =>
      link.events.flatMap((event) => {
        // The booking it was moved to, for "Moved to 8 – 9 pm, Pitch 3"; and whether the one it
        // came from is shown too, so its own "Moved here" would say the same thing twice.
        const entry = describe(event, link.booking, t, {
          next: chain.data[index - 1]?.booking,
          fromShown: index + 1 < chain.data.length,
        });
        return entry ? [entry] : [];
      }),
    ),
    ...checkIns(booking.data, t),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  // Under each day, oldest first.
  const days: { date: string; steps: Step[] }[] = [];
  for (const entry of entries) {
    const date = localDateOf(entry.at, timezone);
    const step: Step = {
      label: entry.label,
      detail: entry.detail,
      when: sentenceTime(entry.at, timezone, t),
      state: "done",
    };
    const last = days.at(-1);
    if (last?.date === date) last.steps.push(step);
    else days.push({ date, steps: [step] });
  }

  const title = t("screens.history.title");
  return (
    <Screen>
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          onTitleLayout={compact.onTitleLayout}
          subtitle={`#${booking.data.code} · ${booking.data.customer.name}`}
        >
          {title}
        </Title>
        <View className="gap-6">
          {days.map((day) => (
            <View key={day.date}>
              <Text className="mb-3 text-label text-ink-2">
                {relativeDay(day.date, now, timezone, t)}
              </Text>
              <StepRail steps={day.steps} />
            </View>
          ))}
        </View>
      </FadingScroll>
    </Screen>
  );
}

// Who did it, as the grey line: staff and players by name, Hagz's own team as Hagz, the system not
// at all (its line says what happened by itself).
const who = (event: Event, t: TFunction) =>
  event.actor.kind === "ADMIN"
    ? t("screens.history.hagz")
    : event.actor.kind === "SYSTEM"
      ? undefined
      : (event.actor.name ?? undefined);

const field = (event: Event, key: string): unknown =>
  typeof event.data === "object" && event.data !== null
    ? (event.data as Record<string, unknown>)[key]
    : undefined;

// What one event says, in words (the events in the API's domain/events.ts).
function describe(
  event: Event,
  booking: Booking,
  t: TFunction,
  { next, fromShown }: { next?: Booking; fromShown: boolean },
): Entry | null {
  const at = event.createdAt;
  const by = who(event, t);
  const player = firstName(booking.customer.name);
  switch (event.type) {
    case "CREATED": {
      if (field(event, "from") && fromShown) return null;
      const status = field(event, "status");
      const label = field(event, "from")
        ? t("screens.history.events.movedHere")
        : status === "UNCONFIRMED"
          ? t("screens.history.events.reserved")
          : status === "HELD" && booking.hold
            ? t("screens.history.events.held")
            : event.actor.kind === "CUSTOMER"
              ? t("screens.history.events.bookedInApp")
              : t("screens.history.events.booked");
      return { at, label, detail: by };
    }
    case "APPROVED":
      return { at, label: t("screens.history.events.approved"), detail: by };
    case "DECLINED": {
      const reason = field(event, "reason");
      return {
        at,
        label: t("screens.history.events.declined"),
        detail: [by, typeof reason === "string" ? `“${reason}”` : null].filter(Boolean).join(" · "),
      };
    }
    case "CONFIRMED":
      return field(event, "paymentId")
        ? { at, label: t("screens.history.events.paidOnline"), detail: by }
        : { at, label: t("screens.history.events.confirmed"), detail: by };
    case "EXPIRED":
      return {
        at,
        label: t(
          field(event, "from") === "PENDING"
            ? "screens.history.events.notAnswered"
            : booking.hold
              ? "screens.history.events.holdRanOut"
              : "screens.history.events.notPaid",
        ),
        detail: t("screens.history.events.backOnSale"),
      };
    case "COMPLETED":
      return event.actor.kind === "SYSTEM"
        ? {
            at,
            label: t("screens.history.events.played"),
            detail: t("screens.history.events.setWhenEnded"),
          }
        : { at, label: t("screens.history.events.changedToPlayed"), detail: by };
    case "NO_SHOW":
      return { at, label: t("screens.history.events.noShow"), detail: by };
    case "HOLD_EXTENDED":
      return { at, label: t("screens.history.events.holdExtended"), detail: by };
    case "HOLD_RELEASED":
      return { at, label: t("screens.history.events.holdReleased"), detail: by };
    case "RESCHEDULED":
      return {
        at,
        label: next
          ? t(
              field(event, "type") === "SWAP"
                ? "screens.history.events.swappedTo"
                : "screens.history.events.movedTo",
              {
                hours: hoursSpan(next.startsAt, next.endsAt, next.timezone, t),
                ground: next.ground.name ?? "",
              },
            )
          : t(
              field(event, "type") === "SWAP"
                ? "screens.history.events.swapped"
                : "screens.history.events.moved",
            ),
        detail: by,
      };
    case "MOVE_ACCEPTED":
      return { at, label: t("screens.history.events.moveAccepted", { name: player }) };
    case "MOVE_REJECTED":
      return {
        at,
        label: t("screens.history.events.moveRejected", { name: player }),
        detail: t("screens.history.events.refundedAll"),
      };
    case "RELEASED": {
      const how = field(event, "by");
      return how === "DEADLINE"
        ? {
            at,
            label: t("screens.history.events.notConfirmed"),
            detail: t("screens.history.events.backOnSale"),
          }
        : { at, label: t("screens.history.events.released"), detail: by };
    }
    // The customer's own hold or booking taken up as a week of their new weekly game.
    case "REGULAR_JOINED":
      return {
        at,
        label: t("screens.history.events.regularJoined"),
        detail:
          field(event, "from") === "HELD"
            ? t("screens.history.events.regularJoinedHold")
            : undefined,
      };
    case "REGULAR_CHANGED": {
      const reason = field(event, "reason");
      return {
        at,
        label: t(
          reason === "PAUSED"
            ? "screens.history.events.regularPaused"
            : reason === "ENDED"
              ? "screens.history.events.regularEnded"
              : reason === "REORDERED"
                ? "screens.history.events.regularReordered"
                : reason === "HORIZON"
                  ? "screens.history.events.regularHorizon"
                  : "screens.history.events.regularChanged",
        ),
        detail: t("screens.history.events.backOnSale"),
      };
    }
    default:
      return { at, label: t("screens.history.events.changed"), detail: by };
  }
}

// Everyone checked in, each when and how.
function checkIns(booking: Booking, t: TFunction): Entry[] {
  return (booking.checkIn?.people ?? []).flatMap((person) =>
    person.checkedInAt
      ? [
          {
            at: person.checkedInAt,
            label: t("screens.history.events.checkedIn"),
            detail: t(
              person.manual
                ? "screens.history.events.checkedInByName"
                : "screens.history.events.checkedInCode",
              { name: person.firstName },
            ),
          },
        ]
      : [],
  );
}
