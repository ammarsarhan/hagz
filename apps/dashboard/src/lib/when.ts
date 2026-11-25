import type { TFunction } from "i18next";
import { addDays, clockOf, localDateOf } from "./calendar";
import { intlLocale } from "./language";

// How the staff app writes a day and a time at the venue's clock, shared by the Calendar and the
// booking requests: "Wed 25 Nov", "4pm" in the Calendar's hour column, "6:55 pm" in sentences,
// and a game's hours as "10 – 11 pm" or "10 pm – 12 am".

// A day, short (user): "Wed 25 Nov", the way the customer app writes one.
export const dayLabel = (date: string, t: TFunction) => {
  const at = new Date(`${date}T12:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", ...options })
      .format(at)
      .replace(/[.,]/g, "");
  return t("screens.calendar.day", {
    weekday: part({ weekday: "short" }),
    day: at.getUTCDate(),
    month: part({ month: "short" }),
  });
};

const period = (pm: boolean, t: TFunction) => t(pm ? "screens.calendar.pm" : "screens.calendar.am");

// The Calendar's hour column: "4pm", "10:30pm".
export const hourLabel = (at: string, timezone: string, t: TFunction) => {
  const { time, pm } = clockOf(at, timezone);
  return t("screens.calendar.hour", { time, period: period(pm, t) });
};

// In sentences: "6:55 pm".
export const sentenceTime = (at: string | number, timezone: string, t: TFunction) => {
  const { time, pm } = clockOf(at, timezone);
  return t("screens.calendar.time", { time, period: period(pm, t) });
};

// A game's hours: the period once when both ends share it ("10 – 11 pm"), else at each end
// ("10 pm – 12 am").
export const hoursSpan = (from: string, to: string, timezone: string, t: TFunction) => {
  const start = clockOf(from, timezone);
  const end = clockOf(to, timezone);
  return start.pm === end.pm
    ? t("screens.calendar.spanShared", {
        from: start.time,
        to: end.time,
        period: period(end.pm, t),
      })
    : t("screens.calendar.span", {
        from: sentenceTime(from, timezone, t),
        to: sentenceTime(to, timezone, t),
      });
};

// A game's day from where we are: "Today", "Tomorrow", or "Thu 26 Nov".
export const relativeDay = (date: string, now: number, timezone: string, t: TFunction) => {
  const today = localDateOf(now, timezone);
  if (date === today) return t("screens.requests.today");
  if (date === addDays(today, 1)) return t("screens.requests.tomorrow");
  return dayLabel(date, t);
};
