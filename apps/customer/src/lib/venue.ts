import type { components } from "@hagz/api";
import i18n from "@/i18next/i18next";

// The venue page's reading of the API (GET /v1/venues/{slug} and its /availability): when a ground
// can start, and the venue's terms in a player's words.

export type PublicVenue = components["schemas"]["PublicVenue"];
export type PublicGround = components["schemas"]["PublicGround"];
export type VenueAvailability = components["schemas"]["VenueAvailability"];
export type FreeSlot = components["schemas"]["FreeSlot"];

// The times a ground can start a booking: each free slot that begins a run of back-to-back free
// slots (each starting where the last ends) at least the ground's shortest booking long. Slots are
// usually an hour, but staff can add others, so the run is checked by time, not by count.
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

// A time at the venue's clock, whatever the phone's timezone: "9" or "9:30", and its half of the day.
const timeParts = (iso: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const pm = (parts.find((part) => part.type === "dayPeriod")?.value ?? "").toUpperCase() === "PM";
  return { time: `${hour}${minute === "00" ? "" : `:${minute}`}`, pm };
};

const withPeriod = ({ time, pm }: { time: string; pm: boolean }) =>
  i18n.t("formats.time", { time, period: i18n.t(pm ? "formats.pm" : "formats.am") });

// "9 pm", "9:30 pm", "12 am".
export const timeOfDay = (iso: string, timezone: string) => withPeriod(timeParts(iso, timezone));

// "9 – 11 pm" within one half of the day, "11 am – 1 pm" across it.
export const timeRange = (from: string, to: string, timezone: string) => {
  const start = timeParts(from, timezone);
  const end = timeParts(to, timezone);
  return `${start.pm === end.pm ? start.time : withPeriod(start)} – ${withPeriod(end)}`;
};

// The hour (0–23) a time falls in at the venue.
export const hourAt = (iso: string, timezone: string) =>
  Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .find((part) => part.type === "hour")?.value ?? 0,
  );

// The day after a date (YYYY-MM-DD), as a date.
export const nextDate = (date: string) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

// A playing day runs from 5 am to 5 am: the hours after midnight are the night before's
// ("Friday, 12 am" is Friday night, not Friday's small hours).
export const DAY_STARTS = 5;

// Which part of the playing day an hour is in.
export const partOfDay = (hour: number) =>
  hour < DAY_STARTS
    ? ("lateNight" as const)
    : hour < 12
      ? ("morning" as const)
      : hour < 18
        ? ("afternoon" as const)
        : ("evening" as const);

// 1 → "1 hour", 24 → "24 hours".
export const hoursLabel = (hours: number) => i18n.t("formats.hours", { count: hours });

// How long before kick-off booking closes, as the Booking rows say it.
export const noticeLabel = (minutes: number) =>
  minutes === 0
    ? i18n.t("formats.untilStart")
    : minutes < 60
      ? i18n.t("formats.minutesBefore", { count: minutes })
      : i18n.t("formats.hoursBefore", { count: minutes / 60 });

// How players pay, as the Booking rows say it.
export const paymentLabel = (payment: PublicVenue["booking"]["payment"]) =>
  i18n.t(`formats.payment.${payment.mode}`, { percent: payment.depositPercent ?? 0 });

// The same in as few words as it goes, for under the price in the Book bar.
export const paymentShort = (payment: PublicVenue["booking"]["payment"]) =>
  i18n.t(`formats.paymentShort.${payment.mode}`, { percent: payment.depositPercent ?? 0 });

// The cheapest hour across the venue's grounds.
export const cheapestHour = (venue: PublicVenue) => {
  const prices = venue.grounds
    .map((ground) => ground.priceFrom)
    .filter((price): price is number => price !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
};

const sportName = (sport: PublicGround["sport"]) => i18n.t(`formats.sports.${sport}`);

// "A, B and C" ("أ، ب وج" in Arabic).
const listText = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(i18n.t("formats.listComma"))}${i18n.t("formats.listAnd")}${items.at(-1)}`
    : (items[0] ?? "");

// "7-a-side football" for football (the size alone doesn't say the sport), "Padel" for the rest.
export const kindOf = (ground: PublicGround) =>
  ground.size === "STANDARD"
    ? sportName(ground.sport)
    : i18n.t(`formats.footballSizes.${ground.size}`);

// "7-a-side football · Artificial turf · Outdoor".
export const groundLine = (ground: PublicGround) =>
  [
    kindOf(ground),
    i18n.t(`formats.groundSurfaces.${ground.surface}`),
    i18n.t(`formats.settings.${ground.environment}`),
  ].join(" · ");

// "Football, 5 and 7-a-side" or "Football and padel": what's played there, for under the name.
export const sportsLine = (venue: PublicVenue) => {
  const sports = [...new Set(venue.grounds.map((ground) => ground.sport))];
  if (sports.length === 1 && sports[0] === "FOOTBALL") {
    const sizes = [...new Set(venue.grounds.map((ground) => ground.size))].flatMap((size) =>
      size === "STANDARD" ? [] : [i18n.t(`formats.sizesShort.${size}`)],
    );
    return sizes.length > 0
      ? i18n.t("formats.footballWithSizes", { sizes: listText(sizes) })
      : sportName("FOOTBALL");
  }
  // Lower case after the first, in English ("Football and padel"); Arabic has no case.
  return listText(
    sports.map((sport, index) => (index === 0 ? sportName(sport) : sportName(sport).toLowerCase())),
  );
};
