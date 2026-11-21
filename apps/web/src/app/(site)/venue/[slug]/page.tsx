import { links, schemeFor } from "@hagz/contracts";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { appEnv } from "@/lib/env";
import { getAvailability, getVenue, type PublicVenue } from "@/site/api";
import {
  DAY_STARTS,
  dayLabel,
  hourAt,
  nextDate,
  sportsLine,
  startTimes,
  timeOfDay,
  todayAt,
} from "@/site/format";
import { Photos } from "@/site/venue/photos";
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
} from "@/site/venue/sections";

// A venue's public page (PR 3.2's web screen, Figma W2 round 5), server-rendered for search engines
// and for links shared from the app. View only: booking happens in the app.

// Free start times for today's playing day at the venue (5 am to 5 am, so tonight's late hours are
// today's), or tomorrow's when nothing's left today, as the app does.
async function freeTimes(venue: PublicVenue): Promise<FreeTimes> {
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
    const byGround = new Map<string, string[]>();
    for (const ground of venue.grounds) {
      const times = startTimes(slots, ground).map((slot) => timeOfDay(slot.startsAt, timezone));
      if (times.length > 0) byGround.set(ground.id, times.slice(0, 6));
    }
    return byGround;
  };
  // Before 5 am it's still last night's playing day.
  const now = new Date();
  const calendarToday = todayAt(timezone, now);
  const today =
    hourAt(now.toISOString(), timezone) < DAY_STARTS
      ? todayAt(timezone, new Date(now.getTime() - 86_400_000))
      : calendarToday;
  const todays = await read(today);
  if (todays.size > 0 || venue.status !== "LIVE") {
    return { when: "today", day: dayLabel(today), byGround: todays };
  }
  const tomorrow = nextDate(today);
  return { when: "tomorrow", day: dayLabel(tomorrow), byGround: await read(tomorrow) };
}

// This site's own origin, as the request reached it, for the share link and the QR code.
async function origin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3001";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata(props: PageProps<"/venue/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const venue = await getVenue(slug);
  if (!venue) return { title: "Venue not found · Hagz" };
  const name = venue.name ?? "Venue";
  const place = venue.location.area ? ` in ${venue.location.area}` : "";
  const description = `${sportsLine(venue)}${place}. See free times and book ${name} in the Hagz app.`;
  return {
    title: `${name}${place} · Hagz`,
    description,
    openGraph: {
      title: name,
      description,
      images: venue.photos[0] ? [venue.photos[0].url] : undefined,
    },
  };
}

export default async function VenuePage(props: PageProps<"/venue/[slug]">) {
  const { slug } = await props.params;
  const venue = await getVenue(slug);
  if (!venue) notFound();

  const [free, base] = await Promise.all([freeTimes(venue), origin()]);
  const pageUrl = links(base).venue(venue.slug);
  // Opens the customer app on this venue; universal links don't cover /venue yet.
  const appUrl = `${schemeFor("customer", appEnv)}://venue/${encodeURIComponent(venue.slug)}`;
  const qrSvg = await QRCode.toString(pageUrl, { type: "svg", margin: 0 });
  const name = venue.name ?? "Venue";

  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 pt-4 pb-24 lg:pb-0 xl:px-0">
      <Title venue={venue} shareUrl={pageUrl} />
      <div className="mt-6">
        <Photos photos={venue.photos} name={name} />
      </div>
      <div className="mt-10">
        <Highlights venue={venue} />
      </div>
      <div className="mt-10">
        <Hairline />
      </div>
      <div className="mt-12">
        <Grounds venue={venue} free={free} />
      </div>
      <div className="mt-14">
        <Hairline />
      </div>
      {/* From here, two columns: the sections, and the book card sticking beside them (W1). */}
      <div className="mt-14 flex items-start gap-[60px]">
        <div className="flex min-w-0 flex-1 flex-col gap-14 lg:max-w-[680px]">
          <HowBooking venue={venue} />
          <Hairline />
          <Cancellation venue={venue} />
          {venue.booking.cancellation ? <Hairline /> : null}
          <Amenities venue={venue} />
          {venue.amenities.length > 0 ? <Hairline /> : null}
          <About venue={venue} />
          {venue.description ? <Hairline /> : null}
          <Reviews venue={venue} />
          <Hairline />
          <Where venue={venue} />
        </div>
        <aside className="sticky top-8 hidden w-[380px] shrink-0 lg:block">
          <BookCard venue={venue} free={free} appUrl={appUrl} qrSvg={qrSvg} />
        </aside>
      </div>
      <PhoneBar venue={venue} appUrl={appUrl} />
    </main>
  );
}
