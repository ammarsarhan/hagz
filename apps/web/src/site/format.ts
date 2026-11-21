import { refundBands } from "@hagz/contracts";
import type { FreeSlot, PublicGround, PublicVenue } from "./api";
import { intlTag, plural, wordsFor, type Locale } from "./words";

// The venue page's words: the customer app's lib/venue.ts and lib/money.ts, in English and Arabic
// (words.ts). Keep the two saying the same things.

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

// 30000 EGP → "300 EGP" or "300 ج.م": the amount first, as the user writes prices.
export const formatPrice = (minor: number, currency: string, locale: Locale) => {
  const decimals = decimalsOf(currency);
  const amount = (minor / 10 ** decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
  return `${amount} ${wordsFor(locale).currencies[currency] ?? currency}`;
};

// 1 → "1 hour" / "ساعة", 24 → "24 hours" / "24 ساعة".
export const hoursLabel = (hours: number, locale: Locale) =>
  plural(locale, hours, wordsFor(locale).hours);

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

// A playing day runs from 5 am to 5 am: the hours after midnight are the night before's
// ("Saturday, 1 am" is Saturday night), as in the app (lib/venue.ts DAY_STARTS).
export const DAY_STARTS = 5;

const partsAt = (iso: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: value("hour"), minute: value("minute") };
};

// The hour (0–23) a time falls in at the venue.
export const hourAt = (iso: string, timezone: string) => partsAt(iso, timezone).hour;

// "9 pm", "9:30 pm", "12 am" or "9 م", "9:30 م", "12 ص", at the venue's clock.
export const timeOfDay = (iso: string, timezone: string, locale: Locale) => {
  const { hour, minute } = partsAt(iso, timezone);
  const words = wordsFor(locale);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  const time = minute === 0 ? `${twelve}` : `${twelve}:${String(minute).padStart(2, "0")}`;
  return `${time} ${hour < 12 ? words.am : words.pm}`;
};

// Today at the venue, as YYYY-MM-DD.
export const todayAt = (timezone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const nextDate = (date: string) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

const dateParts = (date: string, locale: Locale) => {
  const parts = new Intl.DateTimeFormat(intlTag(locale), {
    timeZone: "UTC",
    weekday: locale === "ar" ? "long" : "short",
    day: "numeric",
    month: locale === "ar" ? "long" : "short",
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { weekday: value("weekday"), day: value("day"), month: value("month") };
};

// "Sat 21 Nov" or "السبت 21 نوفمبر".
export const dayLabel = (date: string, locale: Locale) => {
  const { weekday, day, month } = dateParts(date, locale);
  return `${weekday} ${day} ${month}`;
};

// "Sun" or "الأحد", for a time on a different date from the heading's.
export const weekdayShort = (date: string, locale: Locale) => dateParts(date, locale).weekday;

// "7-a-side football" for football (the size alone doesn't say the sport), "Padel" for the rest.
export const kindOf = (ground: PublicGround, locale: Locale) => {
  const words = wordsFor(locale);
  return ground.size === "STANDARD" ? words.sports[ground.sport] : words.footballSizes[ground.size];
};

// "7-a-side football · Artificial turf · Outdoor".
export const groundLine = (ground: PublicGround, locale: Locale) => {
  const words = wordsFor(locale);
  return [
    kindOf(ground, locale),
    words.surfaces[ground.surface],
    words.settings[ground.environment],
  ].join(" · ");
};

const listText = (items: string[], locale: Locale) => {
  const words = wordsFor(locale);
  return items.length > 1
    ? `${items.slice(0, -1).join(words.listComma)}${words.listAnd}${items.at(-1)}`
    : (items[0] ?? "");
};

// "Football, 5 and 7-a-side" or "Football/Padel": what's played there (the web writes several sports
// with slashes, user 2026-11-21; the app still says "Football and padel").
export const sportsLine = (venue: PublicVenue, locale: Locale) => {
  const words = wordsFor(locale);
  const sports = [...new Set(venue.grounds.map((ground) => ground.sport))];
  if (sports.length === 1 && sports[0] === "FOOTBALL") {
    const sizes = [...new Set(venue.grounds.map((ground) => ground.size))].flatMap((size) =>
      size === "STANDARD" ? [] : [words.sizesShort[size]],
    );
    return sizes.length > 0
      ? words.footballWithSizes(listText(sizes, locale))
      : words.sports.FOOTBALL;
  }
  return sports.map((sport) => words.sports[sport]).join("/");
};

// The cheapest hour across the venue's grounds.
export const cheapestHour = (venue: PublicVenue) => {
  const prices = venue.grounds
    .map((ground) => ground.priceFrom)
    .filter((price): price is number => price !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
};

// How long before kick-off booking closes.
export const noticeLabel = (minutes: number, locale: Locale) => {
  const words = wordsFor(locale);
  return minutes === 0
    ? words.untilStart
    : minutes < 60
      ? plural(locale, minutes, words.minutesBefore)
      : plural(locale, minutes / 60, words.hoursBefore);
};

export const paymentLabel = (payment: Payment, locale: Locale) => {
  const { payment: words } = wordsFor(locale);
  return payment.mode === "DEPOSIT"
    ? words.deposit(payment.depositPercent ?? 0)
    : payment.mode === "PLATFORM"
      ? words.platform
      : words.manual;
};

export const paymentShort = (payment: Payment, locale: Locale) => {
  const { paymentShort: words } = wordsFor(locale);
  return payment.mode === "DEPOSIT"
    ? words.deposit(payment.depositPercent ?? 0)
    : payment.mode === "PLATFORM"
      ? words.platform
      : words.manual;
};

export type HighlightIcon = "instant" | "venueConfirms" | "cancellation" | "payment";

// What booking here is like, in three rows under the photos: how it's confirmed, how long
// cancelling is free, and how you pay.
export const highlightsOf = (venue: PublicVenue, locale: Locale) => {
  const { highlights: words } = wordsFor(locale);
  const hours = (count: number) => hoursLabel(count, locale);
  const { booking } = venue;
  const rows: { icon: HighlightIcon; title: string; line: string }[] = [
    booking.instantConfirmation
      ? { icon: "instant", title: words.instant, line: words.instantLine }
      : { icon: "venueConfirms", title: words.venueConfirms, line: words.venueConfirmsLine },
  ];
  const cancellation = booking.cancellation;
  if (cancellation) {
    const [first, next] = refundBands(cancellation.tiers);
    if (first && first.refundPercent > 0) {
      rows.push({
        icon: "cancellation",
        title:
          first.refundPercent === 100
            ? words.freeCancellation(hours(first.from))
            : words.partBack(first.refundPercent, hours(first.from)),
        line:
          next && next.refundPercent > 0
            ? words.nextBack(next.refundPercent, hours(next.from))
            : words.noRefundAfter,
      });
    }
  }
  const { payment } = booking;
  rows.push(
    payment.mode === "DEPOSIT"
      ? {
          icon: "payment",
          title: words.deposit(payment.depositPercent ?? 0),
          line: words.depositLine,
        }
      : payment.mode === "PLATFORM"
        ? { icon: "payment", title: words.payOnline, line: words.payOnlineLine }
        : { icon: "payment", title: words.payAtVenue, line: words.payAtVenueLine },
  );
  return rows;
};

// "24 hours or more", "6 to 24 hours", "Under 6 hours".
export const bandLabel = (from: number, to: number | null, locale: Locale) => {
  const words = wordsFor(locale);
  return to === null
    ? words.orMore(hoursLabel(from, locale))
    : from === 0
      ? words.under(hoursLabel(to, locale))
      : words.between(from, hoursLabel(to, locale));
};
