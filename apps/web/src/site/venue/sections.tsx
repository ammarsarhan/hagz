import { refundBands } from "@hagz/contracts";
import {
  IconBolt,
  IconCalendarX,
  IconCash,
  IconClock,
  IconMapPin,
  IconStarFilled,
  type Icon,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { amenityIcons } from "@/admin/platform/amenity-icons";
import type { PublicGround, PublicVenue } from "../api";
import {
  bandLabel,
  cheapestHour,
  formatPrice,
  groundLine,
  highlightsOf,
  noticeLabel,
  paymentLabel,
  paymentShort,
  sportsLine,
  type HighlightIcon,
} from "../format";
import { LayoutMap } from "./layout-map";
import { ShareButton } from "./share-button";

// The venue page's sections (Figma W2, round 5): the app's venue page laid out for a desktop, in its
// words. Every way to book ends in the app; the web shows, it doesn't book.

// The free start times shown, per ground, already labelled ("10 pm", or "Sun 1 am" past midnight).
export interface FreeTimes {
  // "today", "tomorrow" or "on Mon 23 Nov": the calendar date of the first time shown.
  when: string;
  // For the Grounds heading: "today, Sat 21 Nov", "tomorrow, Sun 22 Nov" or "Mon 23 Nov".
  heading: string;
  byGround: Map<string, string[]>;
}

const HIGHLIGHT_ICONS: Record<HighlightIcon, Icon> = {
  instant: IconBolt,
  venueConfirms: IconClock,
  cancellation: IconCalendarX,
  payment: IconCash,
};

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-heading font-semibold tracking-[-0.3px]">{title}</h2>
        {note ? <div className="text-label text-ink-2">{note}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Hairline() {
  return <div className="h-px bg-border" />;
}

export function Title({ venue, shareUrl }: { venue: PublicVenue; shareUrl: string }) {
  const { average, count } = venue.rating;
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.8px] md:text-[40px] md:leading-[46px]">
          {venue.name ?? "Venue"}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 text-subtitle">
          {average !== null ? (
            <>
              <IconStarFilled size={16} />
              <span className="font-semibold">{average.toFixed(2)}</span>
              <a href="#reviews" className="font-medium underline">
                {count} {count === 1 ? "review" : "reviews"}
              </a>
            </>
          ) : (
            <span className="text-ink-2">No reviews yet</span>
          )}
          {venue.location.area ? (
            <>
              <span className="text-unit">·</span>
              <span>{venue.location.area}</span>
            </>
          ) : null}
        </div>
        <div className="text-[15px] text-ink-2">{sportsLine(venue)}</div>
      </div>
      <div className="hidden md:block">
        <ShareButton url={shareUrl} />
      </div>
    </div>
  );
}

export function Highlights({ venue }: { venue: PublicVenue }) {
  return (
    <div className="flex max-w-[680px] flex-col gap-5">
      {highlightsOf(venue).map(({ icon, title, line }) => {
        const Glyph = HIGHLIGHT_ICONS[icon];
        return (
          <div key={title} className="flex items-start gap-4">
            <Glyph size={24} stroke={1.75} className="shrink-0" />
            <div className="flex flex-col gap-0.5">
              <div className="text-subtitle font-medium">{title}</div>
              <div className="text-label text-ink-2">{line}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A card shows the first few start times, on one row, so it stays wide rather than square; the
// rest are a quiet grey "+N" chip that says, on hover and to screen readers, they're in the app
// (user, 2026-11-21). Spelt out in full it wrapped onto a second row in the two-column cards.
const CARD_TIMES = 3;

function GroundCard({
  ground,
  currency,
  times,
  when,
}: {
  ground: PublicGround;
  currency: string;
  times: string[];
  when: string;
}) {
  const closed = ground.status === "MAINTENANCE";
  return (
    <div className="flex flex-col rounded-[20px] border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[17px] leading-[22px] font-medium">{ground.name ?? "Ground"}</div>
        {closed || ground.priceFrom === null ? (
          <div className="text-label text-ink-2">{closed ? "Closed for now" : "Prices vary"}</div>
        ) : (
          <div className="shrink-0">
            <span className="text-subtitle font-medium">
              {formatPrice(ground.priceFrom, currency)}
            </span>
            <span className="text-label text-ink-2"> /hr</span>
          </div>
        )}
      </div>
      <div className="mt-1 text-label text-ink-2">{groundLine(ground)}</div>
      {closed ? null : times.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {times.slice(0, CARD_TIMES).map((time) => (
            <span
              key={time}
              className="flex h-[34px] items-center rounded-full border border-border px-3 text-label font-medium"
            >
              {time}
            </span>
          ))}
          {times.length > CARD_TIMES ? (
            <span
              title={`${times.length - CARD_TIMES} more ${times.length - CARD_TIMES === 1 ? "time" : "times"} in the app`}
              aria-label={`${times.length - CARD_TIMES} more ${times.length - CARD_TIMES === 1 ? "time" : "times"} in the app`}
              className="flex h-[34px] items-center rounded-full bg-chip px-3 text-label font-medium text-ink-2"
            >
              +{times.length - CARD_TIMES}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 text-label text-ink-2">No free times {when}</div>
      )}
    </div>
  );
}

// The grounds across the full width (from W2): the map on the left and the cards in two columns
// beside it; with no map, the cards take the width.
export function Grounds({ venue, free }: { venue: PublicVenue; free: FreeTimes }) {
  const cards = venue.grounds.map((ground) => (
    <GroundCard
      key={ground.id}
      ground={ground}
      currency={venue.marketplace.currency}
      times={free.byGround.get(ground.id) ?? []}
      when={free.when}
    />
  ));
  return (
    <Section title="Grounds" note={`Free times ${free.heading}`}>
      {venue.layout ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="lg:w-[512px] lg:shrink-0">
            <LayoutMap
              layout={venue.layout}
              grounds={venue.grounds}
              amenities={venue.amenities}
              boxWidth={512}
              boxHeight={380}
            />
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">{cards}</div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      )}
    </Section>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => (
        <div key={row.label}>
          {index > 0 ? <Hairline /> : null}
          <div className="flex h-12 items-center justify-between gap-4">
            <div className="text-body text-ink-2">{row.label}</div>
            <div className="text-body font-medium">{row.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HowBooking({ venue }: { venue: PublicVenue }) {
  const { booking } = venue;
  const rows = [
    {
      label: "Confirmation",
      value: booking.instantConfirmation ? "Instant" : "The venue confirms",
    },
    { label: "Book up to", value: noticeLabel(booking.minimumNotice) },
    { label: "Payment", value: paymentLabel(booking.payment) },
    ...(booking.loyalty
      ? [{ label: "Loyalty", value: `1 free after ${booking.loyalty.stamps} bookings` }]
      : []),
  ];
  return (
    <Section title="How booking works">
      <Rows rows={rows} />
    </Section>
  );
}

export function Cancellation({ venue }: { venue: PublicVenue }) {
  const cancellation = venue.booking.cancellation;
  if (!cancellation) return null;
  return (
    <Section title="Cancellation policy">
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex h-10 items-center justify-between bg-chip px-5 text-caption font-medium text-ink-2">
          <span>Cancel before it starts</span>
          <span>You get back</span>
        </div>
        {refundBands(cancellation.tiers).map((band) => (
          <div key={band.from}>
            <Hairline />
            <div className="flex h-12 items-center justify-between gap-4 px-5 text-body">
              <span>{bandLabel(band.from, band.to)}</span>
              <span className={band.refundPercent > 0 ? "font-medium" : "text-unit"}>
                {band.refundPercent === 100
                  ? "Everything"
                  : band.refundPercent === 0
                    ? "Nothing"
                    : `${band.refundPercent}%`}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-label text-ink-2">If the venue cancels, you get everything back.</div>
    </Section>
  );
}

export function Amenities({ venue }: { venue: PublicVenue }) {
  if (venue.amenities.length === 0) return null;
  return (
    <Section title="What’s here">
      <div className="flex flex-wrap gap-2">
        {venue.amenities.map((amenity) => {
          const Glyph = amenityIcons[amenity.icon].icon;
          const price =
            amenity.price !== null
              ? ` · ${formatPrice(amenity.price, venue.marketplace.currency)}${amenity.pricing === "PER_HOUR" ? "/hr" : ""}`
              : "";
          return (
            <span
              key={amenity.id}
              className="flex h-9 items-center gap-2 rounded-full bg-chip px-3.5 text-label font-medium"
            >
              <Glyph size={18} stroke={1.75} />
              {amenity.name}
              {price}
            </span>
          );
        })}
      </div>
    </Section>
  );
}

export function About({ venue }: { venue: PublicVenue }) {
  if (!venue.description) return null;
  return (
    <Section title="About">
      <p className="text-subtitle leading-[26px] whitespace-pre-line">{venue.description}</p>
    </Section>
  );
}

export function Reviews({ venue }: { venue: PublicVenue }) {
  const { average, count } = venue.rating;
  return (
    <div id="reviews" className="scroll-mt-[104px]">
      <Section title="Reviews">
        {average !== null ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-end gap-4">
              <div className="text-[56px] leading-[56px] font-semibold tracking-[-1.5px]">
                {average.toFixed(2)}
              </div>
              <div className="flex flex-col gap-1 pb-1">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <IconStarFilled key={i} size={16} />
                  ))}
                </div>
                <div className="text-label text-ink-2">
                  from {count} {count === 1 ? "player" : "players"}
                </div>
              </div>
            </div>
            <div className="text-body text-ink-2">
              Players review a venue in the app after they’ve played there.
            </div>
          </div>
        ) : (
          <div className="text-body text-ink-2">
            No reviews yet. Players can review a venue after they’ve played there.
          </div>
        )}
      </Section>
    </div>
  );
}

export function Where({ venue }: { venue: PublicVenue }) {
  const { coordinates, address, area } = venue.location;
  const point = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : null;
  return (
    <Section title="Where it is">
      {point ? (
        <iframe
          title={`Map of ${venue.name ?? "the venue"}`}
          src={`https://maps.google.com/maps?q=${point}&z=15&output=embed`}
          loading="lazy"
          className="h-[280px] w-full rounded-2xl border-0 bg-chip"
        />
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="text-subtitle font-medium">{address ?? area ?? "Address not given"}</div>
          {address && area ? <div className="text-label text-ink-2">{area}</div> : null}
        </div>
        {point ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${point}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-chip px-[18px] text-[15px] font-semibold"
          >
            <IconMapPin size={18} stroke={1.75} />
            Directions
          </a>
        ) : null}
      </div>
    </Section>
  );
}

// The one call to action (W1's card): the price, today's free times by ground, Book in the app, and
// a QR code for opening the page on a phone. Sticks beside the sections from How booking works down.
export function BookCard({
  venue,
  free,
  appUrl,
  qrSvg,
}: {
  venue: PublicVenue;
  free: FreeTimes;
  appUrl: string;
  qrSvg: string;
}) {
  const cheapest = cheapestHour(venue);
  const rows = venue.grounds.flatMap((ground) => {
    const times = free.byGround.get(ground.id) ?? [];
    return times.length > 0 ? [{ name: ground.name ?? "Ground", times: times.slice(0, 3) }] : [];
  });
  return (
    <div
      id="get-the-app"
      className="flex scroll-mt-[104px] flex-col rounded-[20px] border border-border bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.08)]"
    >
      {cheapest !== null ? (
        <div>
          <span className="text-heading font-semibold">
            {formatPrice(cheapest, venue.marketplace.currency)}
          </span>
          <span className="text-subtitle text-ink-2"> /hr and up</span>
        </div>
      ) : null}
      <div className="mt-1 text-label text-ink-2">{paymentShort(venue.booking.payment)}</div>
      <div className="my-5 h-px bg-border" />
      <div className="text-subtitle font-medium">Free {free.when}</div>
      {rows.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2.5">
          {rows.map((row) => (
            <div key={row.name} className="flex justify-between gap-4 text-label">
              <span className="font-medium">{row.name}</span>
              <span className="text-ink-2">{row.times.join(", ")}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-label text-ink-2">Nothing free {free.when}.</div>
      )}
      <a
        href={appUrl}
        className="mt-6 flex h-[52px] items-center justify-center rounded-full bg-primary text-subtitle font-semibold text-on-primary"
      >
        Book in the app
      </a>
      <div className="mt-5 flex items-center gap-3.5">
        <div
          aria-label="QR code for this page"
          role="img"
          className="size-[68px] shrink-0 [&>svg]:size-full"
          // Generated on the server from this page's own URL.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col gap-0.5">
          <div className="text-label font-medium">Scan with your phone</div>
          <div className="text-[12px] leading-4 text-ink-2">
            Opens {venue.name ?? "the venue"} in Hagz, or the store if you don’t have it.
          </div>
        </div>
      </div>
    </div>
  );
}

// On a phone the card's room is a bar fixed at the bottom (Figma W2, phone frame).
export function PhoneBar({ venue, appUrl }: { venue: PublicVenue; appUrl: string }) {
  const cheapest = cheapestHour(venue);
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border bg-white px-6 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex flex-col">
        {cheapest !== null ? (
          <div>
            <span className="text-subtitle font-medium">
              {formatPrice(cheapest, venue.marketplace.currency)}
            </span>
            <span className="text-label text-ink-2"> /hr</span>
          </div>
        ) : null}
        <div className="text-label text-ink-2">{paymentShort(venue.booking.payment)}</div>
      </div>
      <a
        href={appUrl}
        className="flex h-12 items-center rounded-full bg-primary px-6 text-subtitle font-semibold text-on-primary"
      >
        Book in the app
      </a>
    </div>
  );
}
