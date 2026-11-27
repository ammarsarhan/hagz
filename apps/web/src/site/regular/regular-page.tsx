"use client";

import type { components } from "@hagz/api";
import { links } from "@hagz/contracts";
import { IconChevronRight } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { dayLabel, timeOfDay, todayAt } from "../format";
import { useHud } from "../hud";
import { StoreBadges } from "../store-badges";
import { intlTag, pathIn, wordsFor, type Locale } from "../words";

// A regular's confirm link, /regular and /ar/regular (Figma W5, 391:2): the week a venue asked
// about, and I'm playing / Not this week while it waits; then what became of it: playing, let go
// by them, missed (nobody confirmed in time), or changed by the venue. The booking's code sits on top, for the regular to quote when they call the venue.
// The token rides in the fragment (never sent to the server with the page, nor logged), so the page
// reads the week in the browser, through this site's /v1.

type Week = components["schemas"]["ReminderWeek"];
type Answer = "confirm" | "release";
type View =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "week"; week: Week; cover: string | null };

const post = async (action: "week" | Answer, token: string, locale: Locale) => {
  const response = await fetch(`/v1/confirm-links/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Language": locale },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  // Not one of ours, or not even shaped like a token (a link cut short): either way it doesn't work.
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`POST ${action}: ${response.status}`);
  return (await response.json()) as Week;
};

// The venue's cover for its row; the page stands without it.
const coverOf = async (slug: string, locale: Locale) => {
  try {
    const response = await fetch(`/v1/venues/${encodeURIComponent(slug)}`, {
      headers: { "Accept-Language": locale },
    });
    if (!response.ok) return null;
    const venue = (await response.json()) as components["schemas"]["PublicVenue"];
    return venue.photos[0]?.url ?? null;
  } catch {
    return null;
  }
};

const tokenOf = () => new URLSearchParams(window.location.hash.slice(1)).get("token");

export function RegularPage({ locale }: { locale: Locale }) {
  const hud = useHud();
  const words = wordsFor(locale);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [answering, setAnswering] = useState<Answer | null>(null);

  useEffect(() => {
    const token = tokenOf();
    if (!token) {
      setView({ kind: "missing" });
      return;
    }
    let live = true;
    void (async () => {
      try {
        const week = await post("week", token, locale);
        if (!live) return;
        if (!week) {
          setView({ kind: "missing" });
          return;
        }
        setView({ kind: "week", week, cover: null });
        const cover = await coverOf(week.venue.slug, locale);
        if (live && cover) setView({ kind: "week", week, cover });
      } catch {
        if (live) setView({ kind: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, [locale]);

  const answer = async (action: Answer) => {
    const token = tokenOf();
    if (!token || view.kind !== "week" || answering) return;
    setAnswering(action);
    try {
      const week = await post(action, token, locale);
      if (week) setView({ ...view, week });
      else setView({ kind: "missing" });
    } catch {
      hud(words.regular.failed);
    } finally {
      setAnswering(null);
    }
  };

  if (view.kind === "loading") {
    return (
      <main className="mx-auto w-full max-w-[640px] px-6 pt-4 pb-12 lg:pt-10" aria-busy="true">
        <div className="h-4 w-24 animate-pulse rounded bg-chip" />
        <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded bg-chip" />
        <div className="mt-3 h-5 w-48 animate-pulse rounded bg-chip" />
        <div className="mt-6 h-[82px] animate-pulse rounded-[16px] bg-chip" />
      </main>
    );
  }

  if (view.kind !== "week") {
    const missing = view.kind === "missing";
    return (
      <main className="mx-auto w-full max-w-[640px] px-6 pt-4 pb-12 lg:pt-10">
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] lg:text-[40px] lg:leading-[46px] rtl:tracking-normal">
          {missing ? words.regular.missingTitle : words.regular.errorTitle}
        </h1>
        <p className="mt-1.5 text-label text-ink-2 lg:text-subtitle">
          {missing ? words.regular.missingLine : words.regular.errorLine}
        </p>
        <NoApp locale={locale} />
      </main>
    );
  }

  const { week, cover } = view;
  const venue = week.venue.name ?? words.theVenue;
  const date = todayAt(week.timezone, new Date(week.startsAt));
  const weekday = new Intl.DateTimeFormat(intlTag(locale), {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  const start = timeOfDay(week.startsAt, week.timezone, locale);
  // "8 – 9 pm", or "11 am – 1 pm" across noon.
  const hoursOf = (from: string, to: string) => {
    const a = timeOfDay(from, week.timezone, locale);
    const b = timeOfDay(to, week.timezone, locale);
    return `${a.split(" ")[1] === b.split(" ")[1] ? a.split(" ")[0] : a} – ${b}`;
  };
  const hours = hoursOf(week.startsAt, week.endsAt);
  const kind =
    week.ground.size === "STANDARD"
      ? words.sports[week.ground.sport]
      : words.footballSizes[week.ground.size];
  const deadline = week.deadline
    ? words.shared.moment(
        dayLabel(todayAt(week.timezone, new Date(week.deadline)), locale),
        timeOfDay(week.deadline, week.timezone, locale),
      )
    : "";
  const waiting = week.state === "WAITING";
  // The code kept left to right inside Arabic, so its # stays in front of it.
  const code = `\u2066#${week.code}\u2069`;
  const { movedTo } = week;
  const line = {
    WAITING: words.regular.waiting(week.name, weekday, deadline, venue, code),
    CONFIRMED: words.regular.playing(venue, weekday, start),
    RELEASED: words.regular.letGo(weekday),
    MISSED: words.regular.missed(deadline, venue, code),
    MOVED: movedTo
      ? words.regular.moved(
          venue,
          words.shared.moment(
            dayLabel(todayAt(week.timezone, new Date(movedTo.startsAt)), locale),
            hoursOf(movedTo.startsAt, movedTo.endsAt),
          ),
          movedTo.ground.name,
          `\u2066#${movedTo.code}\u2069`,
        )
      : words.regular.changed(venue, code),
    CHANGED: words.regular.changed(venue, code),
  }[week.state];
  const venuePage = pathIn(locale, links("").venue(week.venue.slug));

  return (
    <main
      className={`mx-auto w-full max-w-[640px] px-6 pt-4 lg:pt-10 ${waiting ? "pb-36" : "pb-12"} lg:pb-12`}
    >
      {/* Left to right in Arabic too, so the # stays in front of the code. */}
      <div className="text-caption font-medium tracking-[0.04em]">
        <bdi dir="ltr">#{week.code}</bdi>
      </div>
      <h1 className="mt-1.5 text-[30px] leading-9 font-semibold tracking-[-0.02em] lg:text-[40px] lg:leading-[46px] rtl:tracking-normal">
        {words.shared.moment(dayLabel(date, locale), hours)}
      </h1>
      <p className="mt-1.5 text-label text-ink-2 lg:text-subtitle">
        {[week.ground.name, kind].filter(Boolean).join(" · ")}
      </p>

      <a
        href={venuePage}
        aria-label={words.shared.seeVenue(venue)}
        className="mt-6 flex items-center gap-3.5 rounded-[16px] border border-border p-3 hover:bg-chip/60"
      >
        {cover ? (
          <img src={cover} alt="" className="size-14 shrink-0 rounded-[10px] object-cover" />
        ) : (
          <div className="size-14 shrink-0 rounded-[10px] bg-[#c4c8cf]" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-subtitle font-medium">{venue}</span>
          {week.venue.area ? (
            <span className="truncate text-label text-ink-2">{week.venue.area}</span>
          ) : null}
        </div>
        <IconChevronRight
          size={18}
          stroke={1.75}
          className="shrink-0 text-ink-2 rtl:-scale-x-100"
        />
      </a>

      <p className="mt-6 text-label text-ink-2" aria-live="polite">
        {line}
      </p>

      {waiting ? (
        // Fixed at the bottom on a phone (Figma 391:3), in the page on a computer.
        <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-border bg-white px-6 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))] lg:static lg:mt-8 lg:border-0 lg:p-0">
          <button
            type="button"
            disabled={answering !== null}
            onClick={() => void answer("confirm")}
            className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#1d1d1d] text-[15px] font-semibold text-white disabled:opacity-60 lg:flex-none lg:px-6"
          >
            {words.regular.playingButton}
          </button>
          <button
            type="button"
            disabled={answering !== null}
            onClick={() => void answer("release")}
            className="flex h-11 flex-1 items-center justify-center rounded-full bg-chip text-[15px] font-semibold text-ink disabled:opacity-60 lg:flex-none lg:px-6"
          >
            {words.regular.notThisWeek}
          </button>
        </div>
      ) : (
        <a
          href={venuePage}
          className="mt-6 flex h-11 items-center justify-center self-start rounded-full bg-[#1d1d1d] px-6 text-[15px] font-semibold text-white lg:inline-flex"
        >
          {words.shared.seeVenue(venue)}
        </a>
      )}

      <NoApp locale={locale} />
    </main>
  );
}

function NoApp({ locale }: { locale: Locale }) {
  const words = wordsFor(locale);
  return (
    <section className="mt-8">
      <div className="h-px bg-border" />
      <h2 className="mt-8 text-subtitle font-semibold">{words.shared.noApp}</h2>
      <p className="mt-2 text-label text-ink-2">{words.regular.noAppLine}</p>
      <div className="mt-4">
        <StoreBadges locale={locale} />
      </div>
    </section>
  );
}
