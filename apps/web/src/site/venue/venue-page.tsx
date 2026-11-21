import { links, schemeFor } from "@hagz/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { appEnv } from "@/lib/env";
import { getAvailability, getVenue, type PublicVenue, type VenueAvailability } from "../api";
import { dayLabel, nextDate, sportsLine, startTimes, timeOfDay, todayAt } from "../format";
import { origin } from "../origin";
import { wordsFor, type Locale } from "../words";
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

// Free start times for today at the venue. A day runs midnight to midnight, as in the app's See
// times (user, 2026-11-22): today shows only today's hours. When nothing's left today, the page
// shows the next day that has any, up to the last day the venue takes bookings for.
async function freeTimes(venue: PublicVenue, locale: Locale): Promise<FreeTimes> {
  const words = wordsFor(locale);
  const { timezone } = venue.marketplace;
  const today = todayAt(timezone);
  const startsOn = (availability: VenueAvailability | null) =>
    new Map(
      venue.grounds.map(
        (ground) => [ground.id, startTimes(availability?.slots ?? [], ground)] as const,
      ),
    );
  let date = today;
  let availability = await getAvailability(venue.slug, date);
  let starts = startsOn(availability);
  const any = () => [...starts.values()].some((list) => list.length > 0);
  while (!any() && venue.status === "LIVE" && availability && date < availability.days.last) {
    date = nextDate(date);
    availability = await getAvailability(venue.slug, date);
    starts = startsOn(availability);
  }

  const relative = date === today ? words.today : date === nextDate(today) ? words.tomorrow : null;
  const when = relative ?? words.onDay(dayLabel(date, locale));
  const byGround = new Map<string, string[]>();
  for (const [groundId, list] of starts) {
    if (list.length === 0) continue;
    byGround.set(
      groundId,
      list.map((slot) => timeOfDay(slot.startsAt, timezone, locale)),
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

// "/venue/x" or "/ar/venue/x", from the shared routes (links.ts in contracts): the paths the app
// shares.
const venuePath = (slug: string, locale: Locale = "en") => links("").venue(slug, locale);

export async function venueMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const words = wordsFor(locale);
  const venue = await getVenue(slug, locale);
  if (!venue) return { title: words.notFoundTitle };
  const name = venue.name ?? words.venue;
  const area = venue.location.area ?? null;
  const description = words.metaDescription(sportsLine(venue, locale), area, name);
  const path = venuePath(venue.slug);
  const arabic = venuePath(venue.slug, "ar");
  return {
    title: words.metaTitle(name, area),
    description,
    metadataBase: new URL(await origin()),
    // The page in each language, so search engines show the right one.
    alternates: {
      canonical: locale === "ar" ? arabic : path,
      languages: { en: path, ar: arabic, "x-default": path },
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
  const pageUrl = base + venuePath(venue.slug, locale);
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
