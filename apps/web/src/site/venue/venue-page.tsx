import { links, schemeFor } from "@hagz/contracts";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { appEnv } from "@/lib/env";
import { getAvailability, getVenue, type PublicVenue } from "../api";
import {
  DAY_STARTS,
  dayLabel,
  hourAt,
  nextDate,
  sportsLine,
  startTimes,
  timeOfDay,
  todayAt,
  weekdayShort,
} from "../format";
import { pathIn, wordsFor, type Locale } from "../words";
import { Photos } from "./photos";
import {
  About,
  Amenities,
  BookCard,
  Cancellation,
  type FreeTimes,
  Grounds,
  Hairline,
  Highlights,
  HowBooking,
  PhoneBar,
  Reviews,
  Title,
  Where,
} from "./sections";

// A venue's public page (PR 3.2's web screen, Figma W2 round 5), server-rendered for search engines
// and for links shared from the app, in English at /venue/[slug] and Arabic at /ar/venue/[slug].
// View only: booking happens in the app.

// Free start times for the venue's playing day (5 am to 5 am, as in the app), or tomorrow's when
// nothing's left today. Labelled by the real calendar date, though: at 11 pm on Saturday, a 1 am
// start is Sunday's, so the heading names the date of the first time shown, and a time on the date
// after it says its day ("Sun 1 am").
async function freeTimes(venue: PublicVenue, locale: Locale): Promise<FreeTimes> {
  const words = wordsFor(locale);
  const { timezone } = venue.marketplace;
  // The calendar day after 5 am, and the small hours of the next one.
  const read = async (date: string) => {
    const [day, night] = await Promise.all([
      getAvailability(venue.slug, date),
      getAvailability(venue.slug, nextDate(date)),
    ]);
    const slots = [
      ...(day?.slots ?? []).filter((slot) => hourAt(slot.startsAt, timezone) >= DAY_STARTS),
      ...(night?.slots ?? []).filter((slot) => hourAt(slot.startsAt, timezone) < DAY_STARTS),
    ];
    return new Map(venue.grounds.map((ground) => [ground.id, startTimes(slots, ground)] as const));
  };
  const now = new Date();
  const calendarToday = todayAt(timezone, now);
  // Before 5 am it's still last night's playing day.
  const playingToday =
    hourAt(now.toISOString(), timezone) < DAY_STARTS
      ? todayAt(timezone, new Date(now.getTime() - 86_400_000))
      : calendarToday;
  let starts = await read(playingToday);
  let playingDay = playingToday;
  const any = () => [...starts.values()].some((list) => list.length > 0);
  if (!any() && venue.status === "LIVE") {
    playingDay = nextDate(playingToday);
    starts = await read(playingDay);
  }

  // The calendar date of the earliest time shown (the playing day itself when nothing's free).
  const earliest = [...starts.values()]
    .flat()
    .map((slot) => slot.startsAt)
    .sort()[0];
  const date = earliest ? todayAt(timezone, new Date(earliest)) : playingDay;
  const relative =
    date === calendarToday ? words.today : date === nextDate(calendarToday) ? words.tomorrow : null;
  const when = relative ?? words.onDay(dayLabel(date, locale));
  const byGround = new Map<string, string[]>();
  for (const [groundId, list] of starts) {
    if (list.length === 0) continue;
    byGround.set(
      groundId,
      list.map((slot) => {
        const time = timeOfDay(slot.startsAt, timezone, locale);
        const on = todayAt(timezone, new Date(slot.startsAt));
        return on === date ? time : `${weekdayShort(on, locale)} ${time}`;
      }),
    );
  }
  return {
    when,
    heading: words.freeTimesHeading(
      relative ? `${relative}${words.headingJoin}${dayLabel(date, locale)}` : when,
    ),
    byGround,
  };
}

// This site's own origin, as the request reached it, for the share link and the QR code.
async function origin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3001";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// "/venue/x", from the shared routes (links.ts in contracts) so it stays the path the app shares.
const venuePath = (slug: string) => links("").venue(slug);

export async function venueMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const words = wordsFor(locale);
  const venue = await getVenue(slug, locale);
  if (!venue) return { title: words.notFoundTitle };
  const name = venue.name ?? words.venue;
  const area = venue.location.area ?? null;
  const description = words.metaDescription(sportsLine(venue, locale), area, name);
  const path = venuePath(venue.slug);
  return {
    title: words.metaTitle(name, area),
    description,
    metadataBase: new URL(await origin()),
    // The page in each language, so search engines show the right one.
    alternates: {
      canonical: pathIn(locale, path),
      languages: { en: path, ar: pathIn("ar", path), "x-default": path },
    },
    openGraph: {
      title: name,
      description,
      locale: locale === "ar" ? "ar_EG" : "en_GB",
      images: venue.photos[0] ? [venue.photos[0].url] : undefined,
    },
  };
}

export async function VenuePage({ slug, locale }: { slug: string; locale: Locale }) {
  const venue = await getVenue(slug, locale);
  if (!venue) notFound();

  const [free, base] = await Promise.all([freeTimes(venue, locale), origin()]);
  // This page, in this language: what Share copies and the QR code opens.
  const pageUrl = base + pathIn(locale, venuePath(venue.slug));
  // Opens the customer app on this venue; universal links don't cover /venue yet.
  const appUrl = `${schemeFor("customer", appEnv)}://venue/${encodeURIComponent(venue.slug)}`;
  const qrSvg = await QRCode.toString(pageUrl, { type: "svg", margin: 0 });
  const name = venue.name ?? wordsFor(locale).venue;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 pt-4 pb-24 lg:pb-0 xl:px-0">
      <Title venue={venue} shareUrl={pageUrl} locale={locale} />
      <div className="mt-6">
        <Photos photos={venue.photos} name={name} locale={locale} />
      </div>
      <div className="mt-10">
        <Highlights venue={venue} locale={locale} />
      </div>
      <div className="mt-10">
        <Hairline />
      </div>
      <div className="mt-12">
        <Grounds venue={venue} free={free} locale={locale} />
      </div>
      <div className="mt-14">
        <Hairline />
      </div>
      {/* From here, two columns: the sections, and the book card sticking beside them (W1). */}
      <div className="mt-14 flex items-start gap-[60px]">
        <div className="flex min-w-0 flex-1 flex-col gap-14 lg:max-w-[680px]">
          <HowBooking venue={venue} locale={locale} />
          <Hairline />
          <Cancellation venue={venue} locale={locale} />
          {venue.booking.cancellation ? <Hairline /> : null}
          <Amenities venue={venue} locale={locale} />
          {venue.amenities.length > 0 ? <Hairline /> : null}
          <About venue={venue} locale={locale} />
          {venue.description ? <Hairline /> : null}
          <Reviews venue={venue} locale={locale} />
          <Hairline />
          <Where venue={venue} locale={locale} />
        </div>
        <aside className="sticky top-[104px] hidden w-[380px] shrink-0 lg:block">
          <BookCard venue={venue} free={free} appUrl={appUrl} qrSvg={qrSvg} locale={locale} />
        </aside>
      </div>
      <PhoneBar venue={venue} appUrl={appUrl} locale={locale} />
    </main>
  );
}
