import { links, schemeFor } from "@hagz/contracts";
import { IconChevronRight } from "@tabler/icons-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { appEnv } from "@/lib/env";
import { getGame, getSharedBooking, getVenue, type Game, type SharedBooking } from "../api";
import { dayLabel, formatPrice, nextDate, timeOfDay, todayAt } from "../format";
import { origin } from "../origin";
import { StoreBadges } from "../store-badges";
import { pathIn, wordsFor, type Locale } from "../words";
import { Spots } from "./spots";

// A booking's share link, /booking/[code] and /ar/booking/[code] (Figma W4, 316:2–321:2): what
// someone without the app sees. With the app installed the phone opens the link in it (universal
// links) and never gets here. An open game: when and where, its spots, what joining costs, and Join
// in the app; a full or started one says so. A plain booking: when and where, and the venue to book
// a time of their own. Moved: the old and the new time, on to the new link. Called off: so, and the
// venue. View only: joining and booking happen in the app.

// Not happening: called off, never approved or paid, or a regular's week let go.
const OFF = new Set(["CANCELLED", "EXPIRED", "RELEASED"]);
// Evening from 5 pm: "Tonight" rather than "Today".
const EVENING = 17;

type Page =
  | { kind: "game"; booking: SharedBooking; game: Game }
  | { kind: "booking"; booking: SharedBooking }
  | { kind: "moved"; booking: SharedBooking; moved: SharedBooking | null; to: string }
  | { kind: "off"; booking: SharedBooking };

const read = async (code: string, locale: Locale): Promise<Page | null> => {
  const booking = await getSharedBooking(code, locale);
  if (!booking) return null;
  if (booking.status === "RESCHEDULED" && booking.movedTo) {
    const moved = await getSharedBooking(booking.movedTo, locale);
    return { kind: "moved", booking, moved, to: booking.movedTo };
  }
  if (OFF.has(booking.status) || booking.status === "RESCHEDULED") return { kind: "off", booking };
  const game = booking.gameId ? await getGame(booking.gameId, locale) : null;
  // Waiting for the venue or cancelled with its booking: no game to show, just the booking.
  if (game && (game.status === "OPEN" || game.status === "CLOSED"))
    return { kind: "game", booking, game };
  return { kind: "booking", booking };
};

// "Tonight", "Today", "Tomorrow" or "Thu 26 Nov", at the venue's clock; `relative` when it's one of
// the first three, so the date can go beside it.
const dayOf = (iso: string, timezone: string, locale: Locale) => {
  const words = wordsFor(locale).shared;
  const today = todayAt(timezone);
  const date = todayAt(timezone, new Date(iso));
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .find((part) => part.type === "hour")?.value ?? 0,
  );
  if (date === today)
    return { label: hour >= EVENING ? words.tonight : words.today, date, relative: true };
  if (date === nextDate(today)) return { label: words.tomorrow, date, relative: true };
  return { label: dayLabel(date, locale), date, relative: false };
};

// "9 – 11 pm", or "11 am – 1 pm" across noon.
const timeRange = (from: string, to: string, timezone: string, locale: Locale) => {
  const start = timeOfDay(from, timezone, locale);
  const end = timeOfDay(to, timezone, locale);
  const [startTime, startPeriod] = start.split(" ");
  const sameHalf = startPeriod === end.split(" ")[1];
  return `${sameHalf ? startTime : start} – ${end}`;
};

// "Tonight, 9 – 11 pm".
const momentOf = (booking: SharedBooking, locale: Locale) => {
  const day = dayOf(booking.startsAt, booking.timezone, locale);
  return {
    ...day,
    text: wordsFor(locale).shared.moment(
      day.label,
      timeRange(booking.startsAt, booking.endsAt, booking.timezone, locale),
    ),
  };
};

// "5-a-side football" for football (the size alone doesn't say the sport), "Padel" for the rest.
const kindOf = (ground: SharedBooking["ground"], locale: Locale) => {
  const words = wordsFor(locale);
  return ground.size === "STANDARD" ? words.sports[ground.sport] : words.footballSizes[ground.size];
};

// "Pitch 2 · 5-a-side football".
const groundOf = (booking: SharedBooking, locale: Locale) =>
  [booking.ground.name, kindOf(booking.ground, locale)].filter(Boolean).join(" · ");

const venueName = (booking: SharedBooking, locale: Locale) =>
  booking.venue.name ?? wordsFor(locale).theVenue;

export async function bookingMetadata(code: string, locale: Locale): Promise<Metadata> {
  const words = wordsFor(locale).shared;
  const page = await read(code, locale);
  if (!page) return { title: words.notFound, robots: { index: false, follow: false } };
  const when = momentOf(page.booking, locale).text;
  return {
    title:
      page.kind === "game"
        ? words.gameMeta(page.game.booker.firstName, when)
        : words.bookingMeta(when),
    // Someone's own game: kept out of search engines.
    robots: { index: false, follow: false },
  };
}

export async function BookingPage({ code, locale }: { code: string; locale: Locale }) {
  const page = await read(code, locale);
  if (!page) notFound();
  const { booking } = page;
  const words = wordsFor(locale);
  const shared = words.shared;
  const venue = venueName(booking, locale);

  // The venue's cover for its row; the page stands without it.
  const cover = await getVenue(booking.venue.slug, locale)
    .then((found) => found?.photos[0]?.url ?? null)
    .catch(() => null);
  const pageUrl = `${await origin()}${pathIn(locale, `/booking/${booking.code}`)}`;
  const qrSvg = await QRCode.toString(pageUrl, { type: "svg", margin: 0 });
  const scheme = schemeFor("customer", appEnv);
  const venuePage = pathIn(locale, links("").venue(booking.venue.slug));

  const when = momentOf(booking, locale);
  const row = (
    <VenueRow
      href={venuePage}
      name={venue}
      area={booking.venue.area}
      cover={cover}
      label={shared.seeVenue(venue)}
    />
  );

  if (page.kind === "moved") {
    const now = page.moved ? momentOf(page.moved, locale).text : null;
    return (
      <Layout
        code={booking.code}
        title={shared.movedTitle}
        line={[groundOf(booking, locale), venue].join(" · ")}
        action={{ label: shared.seeNewTime, href: pathIn(locale, `/booking/${page.to}`) }}
        qrSvg={qrSvg}
        locale={locale}
      >
        <div className="mt-6 flex flex-col gap-3 rounded-[16px] border border-border p-4">
          <div>
            <div className="text-caption text-ink-2">{shared.was}</div>
            <div className="text-subtitle text-ink-2 line-through">{when.text}</div>
          </div>
          {now ? (
            <div>
              <div className="text-caption text-ink-2">{shared.now}</div>
              <div className="text-subtitle font-medium">{now}</div>
            </div>
          ) : null}
        </div>
        <p className="mt-5 text-label text-ink-2">{shared.movedLine}</p>
      </Layout>
    );
  }

  if (page.kind === "off") {
    return (
      <Layout
        code={booking.code}
        title={shared.offTitle}
        line={[when.text, booking.ground.name, venue].filter(Boolean).join(" · ")}
        action={{ label: shared.seeVenue(venue), href: venuePage }}
        qrSvg={qrSvg}
        locale={locale}
      >
        <p className="mt-5 text-label text-ink-2">{shared.offLine(venue)}</p>
        <div className="mt-6">{row}</div>
      </Layout>
    );
  }

  // The date beside "Tonight" on a computer, where there's room (Figma 321:2).
  const line = (
    <>
      {groundOf(booking, locale)}
      {when.relative ? (
        <span className="hidden lg:inline"> · {dayLabel(when.date, locale)}</span>
      ) : null}
    </>
  );

  if (page.kind === "booking") {
    const played = Date.parse(booking.endsAt) <= Date.now();
    return (
      <Layout
        code={booking.code}
        title={when.text}
        line={line}
        action={{ label: shared.seeVenue(venue), href: venuePage }}
        qrSvg={qrSvg}
        locale={locale}
        noApp
      >
        <div className="mt-6">{row}</div>
        <p className="mt-6 text-label text-ink-2">
          {played ? shared.played(venue) : shared.someones(venue)}
        </p>
      </Layout>
    );
  }

  const { game } = page;
  const name = game.booker.firstName;
  const share = formatPrice(game.sharePrice, game.currency, locale);
  const fee = formatPrice(game.joinFee, game.currency, locale);
  const total = formatPrice(game.sharePrice + game.joinFee, game.currency, locale);
  const started = Date.parse(game.startsAt) <= Date.now();
  const status = game.joinable
    ? shared.spotsLeft(game.spotsLeft, name)
    : game.status === "CLOSED"
      ? shared.closed(name)
      : started
        ? shared.started(name)
        : shared.full(name);

  return (
    <Layout
      code={booking.code}
      title={when.text}
      line={line}
      action={
        game.joinable
          ? { label: shared.join, href: `${scheme}://booking/${booking.code}`, join: true }
          : { label: shared.findAnother, href: `${scheme}://community` }
      }
      card={
        game.joinable ? (
          <div>
            <div className="text-[18px] leading-6 font-medium">{shared.atVenue(total)}</div>
            <div className="mt-0.5 text-label text-ink-2">
              {shared.split(share, name, fee, venue)}
            </div>
          </div>
        ) : null
      }
      scanLine={shared.scanGame}
      qrSvg={qrSvg}
      locale={locale}
      noApp
    >
      <div className="mt-6">{row}</div>
      <div className="mt-6">
        <Spots booker={name} joined={game.playerCount} open={game.spotsLeft} />
      </div>
      <p className="mt-3 text-label text-ink-2">{status}</p>
      {game.joinable ? (
        <>
          {game.note ? (
            // The booker's own words, in their own direction (an English note on the Arabic page).
            <blockquote className="mt-6 border-s-2 border-ink ps-3 text-subtitle">
              <bdi>“{game.note}”</bdi>
            </blockquote>
          ) : null}
          <div className="mt-8 h-px bg-border" />
          <h2 className="mt-8 text-[18px] leading-6 font-semibold">{shared.payHeading}</h2>
          <div className="mt-3 flex flex-col gap-2 text-label">
            <Line label={shared.shareTo(name)} value={share} />
            <Line label={shared.feeTo(venue)} value={fee} />
          </div>
          <div className="mt-4 h-px bg-border" />
          <div className="mt-4 flex justify-between text-label font-semibold">
            <span>{shared.total}</span>
            <span>{total}</span>
          </div>
          <p className="mt-6 text-label text-ink-2">{shared.disclaimer}</p>
        </>
      ) : null}
    </Layout>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-2">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// The venue: its cover, name and area, opening its page.
function VenueRow({
  href,
  name,
  area,
  cover,
  label,
}: {
  href: string;
  name: string;
  area: string | null;
  cover: string | null;
  label: string;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex items-center gap-3.5 rounded-[16px] border border-border p-3 hover:bg-chip/60"
    >
      {cover ? (
        <img src={cover} alt="" className="size-14 shrink-0 rounded-[10px] object-cover" />
      ) : (
        <div className="size-14 shrink-0 rounded-[10px] bg-[#c4c8cf]" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-subtitle font-medium">{name}</span>
        {area ? <span className="truncate text-label text-ink-2">{area}</span> : null}
      </div>
      <IconChevronRight size={18} stroke={1.75} className="shrink-0 text-ink-2 rtl:-scale-x-100" />
    </a>
  );
}

interface Action {
  label: string;
  href: string;
  // Join in the app: lime, with what it opens under it on a phone.
  join?: boolean;
}

// The page around each state: the code, the title and its line on the left, then the state's own
// content; beside it on a computer a card with the action, the QR code and the store badges; on a
// phone "Don't have Hagz yet?" under the content and the action fixed at the bottom.
function Layout({
  code,
  title,
  line,
  action,
  card,
  scanLine,
  qrSvg,
  locale,
  noApp = false,
  children,
}: {
  code: string;
  title: string;
  line: ReactNode;
  action: Action;
  // What goes over the button in the card (the open game's price).
  card?: ReactNode;
  scanLine?: string;
  qrSvg: string;
  locale: Locale;
  // "Don't have Hagz yet?" on a phone (not for a moved or called-off link, Figma 319:2, 320:2).
  noApp?: boolean;
  children: ReactNode;
}) {
  const words = wordsFor(locale);
  const shared = words.shared;
  const button = action.join ? "bg-primary text-on-primary" : "bg-[#1d1d1d] text-white";
  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 pt-4 pb-36 lg:pt-10 lg:pb-0 xl:px-0">
      <div className="flex items-start justify-between gap-[60px]">
        <div className="flex min-w-0 flex-1 flex-col lg:max-w-[640px]">
          {/* Left to right in Arabic too, so the # stays in front of the code. */}
          <div className="text-caption font-medium tracking-[0.04em]">
            <bdi dir="ltr">#{code}</bdi>
          </div>
          <h1 className="mt-1.5 text-[30px] leading-9 font-semibold tracking-[-0.02em] lg:text-[40px] lg:leading-[46px] rtl:tracking-normal">
            {title}
          </h1>
          <p className="mt-1.5 text-label text-ink-2 lg:text-subtitle">{line}</p>
          {children}
          {noApp ? (
            <section id="get-the-app" className="mt-8 scroll-mt-[96px] lg:hidden">
              <div className="h-px bg-border" />
              <h2 className="mt-8 text-subtitle font-semibold">{shared.noApp}</h2>
              <p className="mt-2 text-label text-ink-2">{shared.noAppLine}</p>
              <div className="mt-4">
                <StoreBadges locale={locale} />
              </div>
            </section>
          ) : null}
        </div>
        <aside className="sticky top-[104px] hidden w-[380px] shrink-0 flex-col rounded-[20px] border border-border bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.08)] lg:flex">
          {card}
          <a
            href={action.href}
            className={`${card ? "mt-5" : ""} flex h-[52px] items-center justify-center rounded-full px-6 text-subtitle font-semibold ${button}`}
          >
            {action.label}
          </a>
          <div className="my-5 h-px bg-border" />
          <div className="flex items-center gap-3.5">
            <div
              aria-label={words.qrLabel}
              role="img"
              className="size-[68px] shrink-0 [&>svg]:size-full"
              // Generated on the server from this page's own URL.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="flex flex-col gap-0.5">
              <div className="text-label font-medium">{words.scan}</div>
              <div className="text-[12px] leading-4 text-ink-2">{scanLine ?? shared.scanGame}</div>
            </div>
          </div>
          <div className="my-5 h-px bg-border" />
          <StoreBadges locale={locale} />
        </aside>
      </div>
      {/* On a phone the action is fixed at the bottom (Figma W4 phone frames). */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 border-t border-border bg-white px-6 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden">
        <a
          href={action.href}
          className={`flex h-12 w-full items-center justify-center rounded-full text-subtitle font-semibold ${button}`}
        >
          {action.label}
        </a>
        {action.join ? <div className="text-caption text-ink-2">{shared.joinLine}</div> : null}
      </div>
    </main>
  );
}
