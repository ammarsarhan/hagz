import { refundBands } from "@hagz/contracts";
import type { FreeSlot, PublicGround, PublicVenue } from "./api";

// The venue page's words, in English: the customer app's lib/venue.ts and lib/money.ts with its
// strings inlined. Keep the two saying the same things.

const SPORTS: Record<PublicGround["sport"], string> = {
  FOOTBALL: "Football",
  PADEL: "Padel",
  TENNIS: "Tennis",
  BASKETBALL: "Basketball",
  VOLLEYBALL: "Volleyball",
};
const FOOTBALL_SIZES = {
  FIVE_A_SIDE: "5-a-side football",
  SEVEN_A_SIDE: "7-a-side football",
  ELEVEN_A_SIDE: "11-a-side football",
} as const;
const SIZES_SHORT = { FIVE_A_SIDE: "5", SEVEN_A_SIDE: "7", ELEVEN_A_SIDE: "11" } as const;
const SURFACES: Record<PublicGround["surface"], string> = {
  ARTIFICIAL_TURF: "Artificial turf",
  NATURAL_GRASS: "Natural grass",
  HARD_COURT: "Hard court",
  HARD_WOOD: "Wooden floor",
  CLAY: "Clay",
  SAND: "Sand",
  OTHER: "Other surface",
};
const SETTINGS: Record<PublicGround["environment"], string> = {
  INDOOR: "Indoor",
  OUTDOOR: "Outdoor",
  COVERED: "Covered",
};

type Payment = PublicVenue["booking"]["payment"];

// How many decimals the currency's minor unit has (EGP 2); 2 if the runtime doesn't know the code.
const decimalsOf = (currency: string) => {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
};

// 30000 EGP → "300 EGP": the amount first, as the user writes prices.
export const formatPrice = (minor: number, currency: string) => {
  const decimals = decimalsOf(currency);
  const amount = (minor / 10 ** decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
  return `${amount} ${currency}`;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// 1 → "1 hour", 24 → "24 hours".
export const hoursLabel = (hours: number) => plural(hours, "hour");

// The times a ground can start a booking: each free slot that begins a run of back-to-back free
// slots at least the ground's shortest booking long (checked by time, not by count).
export const startTimes = (slots: FreeSlot[], ground: PublicGround): FreeSlot[] => {
  const own = slots
    .filter((slot) => slot.groundId === ground.id)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return own.filter((first, index) => {
    let run = 1;
    let end = first.endsAt;
    for (let next = index + 1; run < ground.minimumSlots && next < own.length; next++) {
      const slot = own[next];
      if (!slot || slot.startsAt !== end) break;
      end = slot.endsAt;
      run++;
    }
    return run >= ground.minimumSlots;
  });
};

// "9 pm", "9:30 pm", "12 am", at the venue's clock.
export const timeOfDay = (iso: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const period = (parts.find((part) => part.type === "dayPeriod")?.value ?? "").toLowerCase();
  return `${hour}${minute === "00" ? "" : `:${minute}`} ${period}`;
};

// Today at the venue, as YYYY-MM-DD.
export const todayAt = (timezone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

// A playing day runs from 5 am to 5 am: the hours after midnight are the night before's
// ("Saturday, 1 am" is Saturday night), as in the app (lib/venue.ts DAY_STARTS).
export const DAY_STARTS = 5;

// The hour (0–23) a time falls in at the venue.
export const hourAt = (iso: string, timezone: string) =>
  Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .find((part) => part.type === "hour")?.value ?? 0,
  );

export const nextDate = (date: string) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

// "Sat 21 Nov".
export const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(",", "");

// "Sun", for a time on a different date from the heading's.
export const weekdayShort = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(
    new Date(`${date}T12:00:00Z`),
  );

// "7-a-side football" for football (the size alone doesn't say the sport), "Padel" for the rest.
export const kindOf = (ground: PublicGround) =>
  ground.size === "STANDARD" ? SPORTS[ground.sport] : FOOTBALL_SIZES[ground.size];

// "7-a-side football · Artificial turf · Outdoor".
export const groundLine = (ground: PublicGround) =>
  [kindOf(ground), SURFACES[ground.surface], SETTINGS[ground.environment]].join(" · ");

const listText = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : (items[0] ?? "");

// "Football, 5 and 7-a-side" or "Football/Padel": what's played there (the web writes several sports
// with slashes, user 2026-11-21; the app still says "Football and padel").
export const sportsLine = (venue: PublicVenue) => {
  const sports = [...new Set(venue.grounds.map((ground) => ground.sport))];
  if (sports.length === 1 && sports[0] === "FOOTBALL") {
    const sizes = [...new Set(venue.grounds.map((ground) => ground.size))].flatMap((size) =>
      size === "STANDARD" ? [] : [SIZES_SHORT[size]],
    );
    return sizes.length > 0 ? `Football, ${listText(sizes)}-a-side` : "Football";
  }
  return sports.map((sport) => SPORTS[sport]).join("/");
};

// The cheapest hour across the venue's grounds.
export const cheapestHour = (venue: PublicVenue) => {
  const prices = venue.grounds
    .map((ground) => ground.priceFrom)
    .filter((price): price is number => price !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
};

// How long before kick-off booking closes.
export const noticeLabel = (minutes: number) =>
  minutes === 0
    ? "Until it starts"
    : minutes < 60
      ? `${plural(minutes, "minute")} before`
      : `${hoursLabel(minutes / 60)} before`;

export const paymentLabel = (payment: Payment) =>
  payment.mode === "DEPOSIT"
    ? `${payment.depositPercent ?? 0}% online deposit`
    : payment.mode === "PLATFORM"
      ? "Online in full"
      : "Cash at the venue";

export const paymentShort = (payment: Payment) =>
  payment.mode === "DEPOSIT"
    ? `${payment.depositPercent ?? 0}% online`
    : payment.mode === "PLATFORM"
      ? "Paid online"
      : "Cash at the venue";

export type HighlightIcon = "instant" | "venueConfirms" | "cancellation" | "payment";

// What booking here is like, in three rows under the photos: how it's confirmed, how long
// cancelling is free, and how you pay.
export const highlightsOf = (venue: PublicVenue) => {
  const { booking } = venue;
  const rows: { icon: HighlightIcon; title: string; line: string }[] = [
    booking.instantConfirmation
      ? {
          icon: "instant",
          title: "Instant confirmation",
          line: "No waiting for the venue to accept.",
        }
      : {
          icon: "venueConfirms",
          title: "Confirmed by the venue",
          line: "They accept each booking.",
        },
  ];
  const cancellation = booking.cancellation;
  if (cancellation) {
    const [first, next] = refundBands(cancellation.tiers);
    if (first && first.refundPercent > 0) {
      rows.push({
        icon: "cancellation",
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
          icon: "payment",
          title: `${payment.depositPercent ?? 0}% online deposit`,
          line: "The rest at the venue.",
        }
      : payment.mode === "PLATFORM"
        ? { icon: "payment", title: "Pay online", line: "In full when you book." }
        : { icon: "payment", title: "Pay at the venue", line: "In cash, when you play." },
  );
  return rows;
};

// "24 hours or more", "6 to 24 hours", "Under 6 hours".
export const bandLabel = (from: number, to: number | null) =>
  to === null
    ? `${hoursLabel(from)} or more`
    : from === 0
      ? `Under ${hoursLabel(to)}`
      : `${from} to ${hoursLabel(to)}`;
