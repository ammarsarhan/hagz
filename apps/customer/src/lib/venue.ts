import type { components } from "@hagz/api";

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

// "9 pm", "9:30 pm", "12 am", at the venue's clock whatever the phone's timezone.
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

// "Thu 20 Nov" for a local date (YYYY-MM-DD).
export const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(",", "");

// 1 → "1 hour", 24 → "24 hours".
export const hoursLabel = (hours: number) => (hours === 1 ? "1 hour" : `${hours} hours`);

// How long before kick-off booking closes, as the Booking rows say it.
export const noticeLabel = (minutes: number) =>
  minutes === 0
    ? "Until it starts"
    : minutes < 60
      ? `${minutes} minutes before`
      : `${hoursLabel(minutes / 60)} before`;

// How players pay, in a few words.
export const paymentLabel = (payment: PublicVenue["booking"]["payment"]) => {
  switch (payment.mode) {
    case "MANUAL":
      return "Cash at the venue";
    case "DEPOSIT":
      return `${payment.depositPercent ?? 0}% online, the rest at the venue`;
    case "PLATFORM":
      return "Online when you book";
  }
};

// How long before kick-off cancelling is still free, or null when it never is.
export const freeCancellationHours = (venue: PublicVenue) =>
  venue.booking.cancellation?.tiers.find((tier) => tier.refundPercent === 100)?.hours ?? null;

// The cheapest hour across the venue's grounds.
export const cheapestHour = (venue: PublicVenue) => {
  const prices = venue.grounds
    .map((ground) => ground.priceFrom)
    .filter((price): price is number => price !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
};

const SPORTS: Record<PublicGround["sport"], string> = {
  FOOTBALL: "Football",
  PADEL: "Padel",
  TENNIS: "Tennis",
  BASKETBALL: "Basketball",
  VOLLEYBALL: "Volleyball",
};

const SIZES: Record<PublicGround["size"], string> = {
  FIVE_A_SIDE: "5-a-side",
  SEVEN_A_SIDE: "7-a-side",
  ELEVEN_A_SIDE: "11-a-side",
  STANDARD: "",
};

const SURFACES: Record<PublicGround["surface"], string> = {
  NATURAL_GRASS: "Natural grass",
  ARTIFICIAL_TURF: "Artificial turf",
  HARD_WOOD: "Wooden floor",
  HARD_COURT: "Hard court",
  CLAY: "Clay",
  SAND: "Sand",
  OTHER: "Other surface",
};

const ENVIRONMENTS: Record<PublicGround["environment"], string> = {
  INDOOR: "Indoor",
  OUTDOOR: "Outdoor",
  COVERED: "Covered",
};

// "5-a-side" for football, "Padel" for the rest.
export const kindOf = (ground: PublicGround) => SIZES[ground.size] || SPORTS[ground.sport];

// "5-a-side · Artificial turf · Outdoor".
export const groundLine = (ground: PublicGround) =>
  [kindOf(ground), SURFACES[ground.surface], ENVIRONMENTS[ground.environment]].join(" · ");

// "Football, 5 and 7-a-side" or "Football and padel": what's played there, for under the name.
export const sportsLine = (venue: PublicVenue) => {
  const sports = [...new Set(venue.grounds.map((ground) => ground.sport))];
  if (sports.length === 1 && sports[0] === "FOOTBALL") {
    const sizes = [...new Set(venue.grounds.map((ground) => SIZES[ground.size]))]
      .filter(Boolean)
      .map((size) => size.replace("-a-side", ""));
    return sizes.length > 0 ? `Football, ${sizes.join(" and ")}-a-side` : "Football";
  }
  const names = sports.map((sport, index) =>
    index === 0 ? SPORTS[sport] : SPORTS[sport].toLowerCase(),
  );
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : (names[0] ?? "");
};
